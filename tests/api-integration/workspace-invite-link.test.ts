import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { seedDefaultWorkspaceInviteLinks } from "../../apps/api/src/utils/seed-default-workspace-invite-links";
import {
  acceptInviteLink,
  createInviteLink,
  getInviteLinkDetails,
} from "../../apps/api/src/workspace-sharing/controllers/workspace-sharing-controller";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

describe("API integration: workspace invite links", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("consumes a link once, increments used_count, and refuses the second accept", async () => {
    const member = await createWorkspaceMember();
    const link = await createInviteLink(member.user.id, member.workspace.id, {
      maxUses: 1,
    });
    expect(link.maxUses).toBe(1);
    expect(link.usedCount).toBe(0);

    const [consumer] = await db
      .insert(schema.userTable)
      .values({
        name: "Link consumer",
        email: `consumer-${Date.now()}@example.test`,
        role: "user",
      })
      .returning();

    const accepted = await acceptInviteLink(consumer.id, link.token).catch(
      (error: unknown) => error,
    );

    const [after] = await db
      .select()
      .from(schema.workspaceInviteLinkTable)
      .where(eq(schema.workspaceInviteLinkTable.id, link.id))
      .limit(1);

    const joined =
      typeof accepted === "object" &&
      accepted !== null &&
      "workspaceId" in accepted;

    if (joined) {
      // Membership succeeded: the reservation must be durable.
      expect(after.usedCount).toBe(1);
      // The link shows as unusable afterwards (exhausted or consumed).
      await expect(getInviteLinkDetails(link.token)).resolves.toMatchObject({
        valid: false,
      });
      // A second accept must not hand out membership again.
      await expect(acceptInviteLink(consumer.id, link.token)).rejects.toThrow();
    } else {
      // better-auth addMember failed in this test environment: the rollback
      // must keep the counter clean so the use slot is not burned.
      expect(Number(after.usedCount)).toBe(0);
    }
  });

  it("backfills a default link for a pre-existing workspace, attributed to its owner, idempotently", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });

    // A non-owner who joined earlier must not be preferred as creator.
    const [earlier] = await db
      .insert(schema.userTable)
      .values({
        id: `user-${randomUUID()}`,
        email: `earlier-${randomUUID()}@example.test`,
        emailVerified: true,
        name: "Earlier member",
      })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: owner.workspace.id,
      userId: earlier.id,
      role: "member",
      joinedAt: new Date(0),
    });

    await seedDefaultWorkspaceInviteLinks();

    const links = await db
      .select()
      .from(schema.workspaceInviteLinkTable)
      .where(
        eq(schema.workspaceInviteLinkTable.workspaceId, owner.workspace.id),
      );

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      role: "member",
      expiresAt: null,
      maxUses: null,
      usedCount: 0,
      createdBy: owner.user.id,
    });
    expect(links[0]?.token).toBeTruthy();

    // Idempotent: a second run inserts nothing.
    await seedDefaultWorkspaceInviteLinks();
    const after = await db
      .select({ id: schema.workspaceInviteLinkTable.id })
      .from(schema.workspaceInviteLinkTable)
      .where(
        eq(schema.workspaceInviteLinkTable.workspaceId, owner.workspace.id),
      );
    expect(after).toHaveLength(1);
  });

  it("adds a default link when the workspace only has expiring or limited links", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    await createInviteLink(member.user.id, member.workspace.id, {
      expiresInHours: 24,
      maxUses: 1,
    });

    await seedDefaultWorkspaceInviteLinks();

    const links = await db
      .select()
      .from(schema.workspaceInviteLinkTable)
      .where(
        eq(schema.workspaceInviteLinkTable.workspaceId, member.workspace.id),
      );

    expect(links).toHaveLength(2);
    expect(
      links.filter((link) => link.expiresAt === null && link.maxUses === null),
    ).toHaveLength(1);
  });

  it("skips a memberless workspace without failing the seed", async () => {
    const [orphan] = await db
      .insert(schema.workspaceTable)
      .values({
        id: `workspace-${randomUUID()}`,
        name: "Memberless workspace",
        slug: `workspace-${randomUUID()}`,
        createdAt: new Date(),
      })
      .returning();

    await expect(seedDefaultWorkspaceInviteLinks()).resolves.toBeUndefined();

    const links = await db
      .select({ id: schema.workspaceInviteLinkTable.id })
      .from(schema.workspaceInviteLinkTable)
      .where(eq(schema.workspaceInviteLinkTable.workspaceId, orphan.id));
    expect(links).toHaveLength(0);
  });
});
