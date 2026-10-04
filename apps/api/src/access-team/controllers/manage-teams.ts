import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import {
  assertCanManageWorkspaces,
  cleanupOrphanedScopedMembership,
  ensureScopedWorkspaceMembership,
  getTeamMemberIds,
  getTeamWorkspaceIds,
  addTeamMember as materializeTeamMember,
  replaceTeamScope,
  removeTeamMember as revokeTeamMember,
} from "../../utils/access-grants";
import {
  assertCanManageScope,
  serializeTeam,
  type TeamScopeInput,
  validateTeamScope,
} from "./team-helpers";

export type TeamInput = {
  name: string;
  description?: string;
  workspaces: TeamScopeInput[];
};

function toScopeRows(workspaces: TeamScopeInput[]) {
  return workspaces.map((workspace) => ({
    workspaceId: workspace.workspaceId,
    allProjects: workspace.allProjects,
    projectIds: workspace.allProjects ? [] : (workspace.projectIds ?? []),
  }));
}

export async function createTeam(userId: string, input: TeamInput) {
  await validateTeamScope(input.workspaces);
  await assertCanManageScope(userId, input.workspaces);

  const name = input.name.trim();
  const [existing] = await db
    .select({ id: schema.accessTeamTable.id })
    .from(schema.accessTeamTable)
    .where(eq(schema.accessTeamTable.name, name))
    .limit(1);
  if (existing) {
    throw new HTTPException(409, {
      message: "A team with this name already exists",
    });
  }

  const [team] = await db
    .insert(schema.accessTeamTable)
    .values({
      name,
      description: input.description?.trim() || null,
      createdBy: userId,
    })
    .returning();

  if (!team) {
    throw new HTTPException(500, { message: "Failed to create the team" });
  }

  await replaceTeamScope(team.id, toScopeRows(input.workspaces));

  const serialized = await serializeTeam(team.id, userId);
  if (!serialized) {
    throw new HTTPException(500, { message: "Failed to load the team" });
  }
  return serialized;
}

export async function updateTeam(
  userId: string,
  teamId: string,
  input: TeamInput,
) {
  const [team] = await db
    .select({ id: schema.accessTeamTable.id })
    .from(schema.accessTeamTable)
    .where(eq(schema.accessTeamTable.id, teamId))
    .limit(1);
  if (!team) return null;

  const currentScope = await db
    .select({ workspaceId: schema.accessTeamWorkspaceTable.workspaceId })
    .from(schema.accessTeamWorkspaceTable)
    .where(eq(schema.accessTeamWorkspaceTable.teamId, teamId));

  const beforeWorkspaceIds = currentScope.map((row) => row.workspaceId);
  await assertCanManageWorkspaces(userId, beforeWorkspaceIds);
  await validateTeamScope(input.workspaces);
  await assertCanManageScope(userId, input.workspaces);

  const name = input.name.trim();
  const [conflict] = await db
    .select({ id: schema.accessTeamTable.id })
    .from(schema.accessTeamTable)
    .where(eq(schema.accessTeamTable.name, name))
    .limit(1);
  if (conflict && conflict.id !== teamId) {
    throw new HTTPException(409, {
      message: "A team with this name already exists",
    });
  }

  await db
    .update(schema.accessTeamTable)
    .set({
      name,
      description: input.description?.trim() || null,
    })
    .where(eq(schema.accessTeamTable.id, teamId));

  await replaceTeamScope(teamId, toScopeRows(input.workspaces));

  const afterWorkspaceIds = input.workspaces.map(
    (workspace) => workspace.workspaceId,
  );
  const removedWorkspaceIds = beforeWorkspaceIds.filter(
    (workspaceId) => !afterWorkspaceIds.includes(workspaceId),
  );

  const memberIds = await getTeamMemberIds(teamId);
  for (const memberId of memberIds) {
    for (const workspaceId of afterWorkspaceIds) {
      await ensureScopedWorkspaceMembership(memberId, workspaceId);
    }
    for (const workspaceId of removedWorkspaceIds) {
      await cleanupOrphanedScopedMembership(memberId, workspaceId);
    }
  }

  const serialized = await serializeTeam(teamId, userId);
  if (!serialized) {
    throw new HTTPException(500, { message: "Failed to load the team" });
  }
  return serialized;
}

export async function deleteTeam(userId: string, teamId: string) {
  const [team] = await db
    .select({ id: schema.accessTeamTable.id })
    .from(schema.accessTeamTable)
    .where(eq(schema.accessTeamTable.id, teamId))
    .limit(1);
  if (!team) return null;

  const workspaceIds = await getTeamWorkspaceIds(teamId);
  await assertCanManageWorkspaces(userId, workspaceIds);

  const memberIds = await getTeamMemberIds(teamId);

  await db
    .delete(schema.accessTeamTable)
    .where(eq(schema.accessTeamTable.id, teamId));

  for (const memberId of memberIds) {
    for (const workspaceId of workspaceIds) {
      await cleanupOrphanedScopedMembership(memberId, workspaceId);
    }
  }

  return { id: teamId };
}

export async function addTeamMember(
  userId: string,
  teamId: string,
  targetUserId: string,
) {
  const [team] = await db
    .select({ id: schema.accessTeamTable.id })
    .from(schema.accessTeamTable)
    .where(eq(schema.accessTeamTable.id, teamId))
    .limit(1);
  if (!team) return null;

  const workspaceIds = await getTeamWorkspaceIds(teamId);
  await assertCanManageWorkspaces(userId, workspaceIds);

  const [target] = await db
    .select({ id: schema.userTable.id })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, targetUserId))
    .limit(1);
  if (!target) {
    throw new HTTPException(404, { message: "User not found" });
  }

  await materializeTeamMember(targetUserId, teamId);

  const serialized = await serializeTeam(teamId, userId);
  if (!serialized) {
    throw new HTTPException(500, { message: "Failed to load the team" });
  }
  return serialized;
}

export async function removeTeamMember(
  userId: string,
  teamId: string,
  targetUserId: string,
) {
  const [team] = await db
    .select({ id: schema.accessTeamTable.id })
    .from(schema.accessTeamTable)
    .where(eq(schema.accessTeamTable.id, teamId))
    .limit(1);
  if (!team) return null;

  const workspaceIds = await getTeamWorkspaceIds(teamId);
  await assertCanManageWorkspaces(userId, workspaceIds);

  await revokeTeamMember(targetUserId, teamId);

  const serialized = await serializeTeam(teamId, userId);
  if (!serialized) {
    throw new HTTPException(500, { message: "Failed to load the team" });
  }
  return serialized;
}
