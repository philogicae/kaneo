import { randomBytes } from "node:crypto";
import { and, asc, inArray, isNull, sql } from "drizzle-orm";
import db, { schema } from "../database";

/**
 * Insert a workspace's default shareable invite link: no expiry, unlimited
 * uses, member role. Shared by the workspace-creation hook and the boot-time
 * backfill so both produce identical links.
 */
export async function createDefaultWorkspaceInviteLink(
  workspaceId: string,
  createdBy: string,
) {
  await db.insert(schema.workspaceInviteLinkTable).values({
    workspaceId,
    token: randomBytes(24).toString("base64url"),
    role: "member",
    createdBy,
  });
}

/**
 * Backfill the default invite link for every workspace that lacks one (no
 * expiry, unlimited uses). Runs on API startup after Drizzle migrations, so
 * pre-existing workspaces — created before the auto-seed hook — get the same
 * permanent link, and a revoked default link is re-created on the next boot.
 *
 * `created_by` is NOT NULL: the workspace owner is used, falling back to the
 * earliest-joined member. Workspaces with no member at all are skipped with a
 * warning, since there is no user to attribute the link to.
 *
 * Idempotent: only workspaces without a default link receive one.
 */
export async function seedDefaultWorkspaceInviteLinks() {
  try {
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'workspace_invite_link'
      ) AS exists;
    `);

    const exists =
      tableExists.rows[0]?.exists === true ||
      tableExists.rows[0]?.exists === "t";
    if (!exists) {
      console.log(
        "🛈 workspace_invite_link table does not exist; skipping default invite-link seed.",
      );
      return;
    }

    const workspaces = await db
      .select({ id: schema.workspaceTable.id })
      .from(schema.workspaceTable);

    if (workspaces.length === 0) {
      return;
    }

    const workspaceIds = workspaces.map((w) => w.id);

    const defaults = await db
      .select({ workspaceId: schema.workspaceInviteLinkTable.workspaceId })
      .from(schema.workspaceInviteLinkTable)
      .where(
        and(
          inArray(schema.workspaceInviteLinkTable.workspaceId, workspaceIds),
          isNull(schema.workspaceInviteLinkTable.expiresAt),
          isNull(schema.workspaceInviteLinkTable.maxUses),
        ),
      );

    const withDefault = new Set(defaults.map((link) => link.workspaceId));
    const missing = workspaceIds.filter((id) => !withDefault.has(id));

    if (missing.length === 0) {
      return;
    }

    // Rows come back ordered by join date; prefer the owner as the link's
    // creator and otherwise keep the earliest-joined member.
    const members = await db
      .select({
        workspaceId: schema.workspaceUserTable.workspaceId,
        userId: schema.workspaceUserTable.userId,
        role: schema.workspaceUserTable.role,
      })
      .from(schema.workspaceUserTable)
      .where(inArray(schema.workspaceUserTable.workspaceId, missing))
      .orderBy(asc(schema.workspaceUserTable.joinedAt));

    const creatorByWorkspace = new Map<string, string>();
    for (const member of members) {
      if (
        member.role === "owner" ||
        !creatorByWorkspace.has(member.workspaceId)
      ) {
        creatorByWorkspace.set(member.workspaceId, member.userId);
      }
    }

    let seeded = 0;
    for (const workspaceId of missing) {
      const createdBy = creatorByWorkspace.get(workspaceId);
      if (!createdBy) {
        console.warn(
          `⚠️ Skipping default invite-link seed for workspace ${workspaceId}: no member to attribute it to.`,
        );
        continue;
      }
      await createDefaultWorkspaceInviteLink(workspaceId, createdBy);
      seeded += 1;
    }

    if (seeded > 0) {
      console.log(
        `✅ Seeded ${seeded} default workspace invite link(s) across ${workspaceIds.length} workspace(s).`,
      );
    }
  } catch (error) {
    console.error("❌ Failed to seed default workspace invite links:", error);
    throw error;
  }
}
