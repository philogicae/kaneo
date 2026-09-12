import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { auth } from "../../auth";
import db, { schema } from "../../database";
import {
  workspaceInviteLinkTable,
  workspaceTable,
} from "../../database/schema";
import type {
  WorkspaceInviteLink,
  WorkspaceInviteLinkAcceptResult,
  WorkspaceInviteLinkCreated,
} from "../types";

const ACTIVE = or(
  isNull(workspaceInviteLinkTable.expiresAt),
  gt(workspaceInviteLinkTable.expiresAt, sql`now()`),
);

const NOT_EXHAUSTED = or(
  isNull(workspaceInviteLinkTable.maxUses),
  sql`${workspaceInviteLinkTable.usedCount} < ${workspaceInviteLinkTable.maxUses}`,
);

export function toLinkRow(
  link: {
    id: string;
    workspaceId: string;
    token: string;
    role: string;
    expiresAt: Date | null;
    maxUses: number | null;
    usedCount: number;
    createdAt: Date;
  },
  workspaceName: string,
): WorkspaceInviteLink {
  return {
    id: link.id,
    workspaceId: link.workspaceId,
    workspaceName,
    token: link.token,
    role: link.role,
    expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
    maxUses: link.maxUses,
    usedCount: link.usedCount,
    createdAt: link.createdAt.toISOString(),
  };
}

export async function createInviteLink(
  userId: string,
  workspaceId: string,
  options: { expiresInHours?: number; maxUses?: number },
): Promise<WorkspaceInviteLinkCreated> {
  const workspace = await db.query.workspaceTable.findFirst({
    where: eq(workspaceTable.id, workspaceId),
  });
  if (!workspace) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }

  const [created] = await db
    .insert(schema.workspaceInviteLinkTable)
    .values({
      workspaceId,
      token: randomBytes(24).toString("base64url"),
      role: "member",
      ...(options.expiresInHours
        ? {
            expiresAt: new Date(
              Date.now() + options.expiresInHours * 3600 * 1000,
            ),
          }
        : {}),
      ...(options.maxUses ? { maxUses: options.maxUses } : {}),
      createdBy: userId,
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, { message: "Failed to create the link" });
  }
  return toLinkRow(created, workspace.name);
}

export function listInviteLinks(workspaceId: string) {
  return db
    .select({
      id: schema.workspaceInviteLinkTable.id,
      workspaceId: schema.workspaceInviteLinkTable.workspaceId,
      token: schema.workspaceInviteLinkTable.token,
      role: schema.workspaceInviteLinkTable.role,
      expiresAt: schema.workspaceInviteLinkTable.expiresAt,
      maxUses: schema.workspaceInviteLinkTable.maxUses,
      usedCount: schema.workspaceInviteLinkTable.usedCount,
      createdAt: schema.workspaceInviteLinkTable.createdAt,
      workspaceName: workspaceTable.name,
    })
    .from(schema.workspaceInviteLinkTable)
    .innerJoin(
      workspaceTable,
      eq(workspaceTable.id, schema.workspaceInviteLinkTable.workspaceId),
    )
    .where(eq(schema.workspaceInviteLinkTable.workspaceId, workspaceId))
    .orderBy(desc(schema.workspaceInviteLinkTable.createdAt));
}

export async function deleteInviteLink(
  workspaceId: string,
  linkId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(schema.workspaceInviteLinkTable)
    .where(
      and(
        eq(schema.workspaceInviteLinkTable.id, linkId),
        eq(schema.workspaceInviteLinkTable.workspaceId, workspaceId),
      ),
    )
    .returning({ id: schema.workspaceInviteLinkTable.id });
  return deleted.length > 0;
}

/** Look up a usable link by token; returns an error reason when unusable. */
export type InviteLinkDetails =
  | { valid: true; workspaceName: string; createdAt: Date }
  | { valid: false; workspaceName?: string; error: string };

export async function getInviteLinkDetails(
  token: string,
): Promise<InviteLinkDetails> {
  const rows = await db
    .select({
      id: schema.workspaceInviteLinkTable.id,
      role: schema.workspaceInviteLinkTable.role,
      expiresAt: schema.workspaceInviteLinkTable.expiresAt,
      maxUses: schema.workspaceInviteLinkTable.maxUses,
      usedCount: schema.workspaceInviteLinkTable.usedCount,
      createdAt: schema.workspaceInviteLinkTable.createdAt,
      workspaceName: workspaceTable.name,
    })
    .from(schema.workspaceInviteLinkTable)
    .innerJoin(
      workspaceTable,
      eq(workspaceTable.id, schema.workspaceInviteLinkTable.workspaceId),
    )
    .where(eq(schema.workspaceInviteLinkTable.token, token))
    .limit(1);

  const link = rows[0];
  if (!link) {
    return { valid: false, error: "This invite link does not exist" };
  }

  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    return {
      valid: false,
      workspaceName: link.workspaceName,
      error: "This invite link has expired",
    };
  }

  if (link.maxUses !== null && link.usedCount >= link.maxUses) {
    return {
      valid: false,
      workspaceName: link.workspaceName,
      error: "This invite link has reached its usage limit",
    };
  }

  return {
    valid: true,
    workspaceName: link.workspaceName,
    createdAt: link.createdAt,
  };
}

/**
 * Consume a usable link (expires/limit enforced atomically) and add the signed-in
 * user to the workspace as a member through better-auth.
 */
export async function acceptInviteLink(
  userId: string,
  token: string,
): Promise<WorkspaceInviteLinkAcceptResult> {
  const consumed = await db
    .update(schema.workspaceInviteLinkTable)
    .set({ usedCount: sql`${schema.workspaceInviteLinkTable.usedCount} + 1` })
    .where(
      and(
        eq(schema.workspaceInviteLinkTable.token, token),
        ACTIVE,
        NOT_EXHAUSTED,
      ),
    )
    .returning({ workspaceId: schema.workspaceInviteLinkTable.workspaceId });

  const link = consumed[0];
  if (!link) {
    throw new HTTPException(410, {
      message: "This invite link is expired, exhausted, or does not exist",
    });
  }

  const member = (await auth.api
    .addMember({
      body: {
        organizationId: link.workspaceId,
        userId,
        // better-auth's inferred role type is owner-only when custom access
        // control is present; "member" is seeded per-workspace at runtime.
        role: "member" as "owner",
      },
    })
    .catch(() => null)) as { member: { id: string } } | null;

  if (!member?.member) {
    // Roll the reservation back so burned use slots match real memberships.
    await db
      .update(schema.workspaceInviteLinkTable)
      .set({
        usedCount: sql`${schema.workspaceInviteLinkTable.usedCount} - 1`,
      })
      .where(
        and(
          eq(schema.workspaceInviteLinkTable.token, token),
          sql`${schema.workspaceInviteLinkTable.usedCount} > 0`,
        ),
      );
    throw new HTTPException(500, { message: "Failed to join the workspace" });
  }

  const workspace = await db.query.workspaceTable.findFirst({
    where: eq(workspaceTable.id, link.workspaceId),
  });
  if (!workspace) {
    throw new HTTPException(410, {
      message: "This workspace no longer exists",
    });
  }

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    role: "member",
  };
}

export type { WorkspaceInviteLink };
