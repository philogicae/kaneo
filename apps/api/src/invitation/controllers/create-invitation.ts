import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  type TeamScopeInput,
  validateTeamScope,
} from "../../access-team/controllers/team-helpers";
import { auth } from "../../auth";
import db, { schema } from "../../database";
import {
  assertCanManageWorkspaces,
  getTeamWorkspaceIds,
} from "../../utils/access-grants";

export type CreateInvitationInput = {
  email: string;
  role?: string;
  workspaces: TeamScopeInput[];
  teamIds: string[];
};

function normalizedWorkspaces(workspaces: TeamScopeInput[]) {
  return workspaces.map((workspace) => ({
    workspaceId: workspace.workspaceId,
    allProjects: workspace.allProjects,
    projectIds: workspace.allProjects ? [] : (workspace.projectIds ?? []),
  }));
}

export default async function createInvitation(
  userId: string,
  input: CreateInvitationInput,
  headers: Headers,
) {
  const email = input.email.trim().toLowerCase();
  if (!email) {
    throw new HTTPException(400, { message: "Email is required" });
  }

  const workspaces = normalizedWorkspaces(input.workspaces);
  await validateTeamScope(workspaces);

  // Teams keep flowing after acceptance, so their current workspace scope only
  // feeds validation and primary-workspace selection.
  const teamWorkspaceIds = new Set<string>();
  for (const teamId of input.teamIds) {
    const [team] = await db
      .select({ id: schema.accessTeamTable.id })
      .from(schema.accessTeamTable)
      .where(eq(schema.accessTeamTable.id, teamId))
      .limit(1);
    if (!team) {
      throw new HTTPException(400, { message: "Unknown team" });
    }
    for (const workspaceId of await getTeamWorkspaceIds(teamId)) {
      teamWorkspaceIds.add(workspaceId);
    }
  }

  const manualWorkspaceIds = workspaces.map(
    (workspace) => workspace.workspaceId,
  );
  const allWorkspaceIds = [
    ...new Set([...manualWorkspaceIds, ...teamWorkspaceIds]),
  ];
  if (allWorkspaceIds.length === 0) {
    throw new HTTPException(400, {
      message: "Select at least one workspace or team",
    });
  }

  // The inviter must administer every workspace they grant access to,
  // including the ones reached through a team.
  await assertCanManageWorkspaces(userId, allWorkspaceIds);

  const primaryWorkspaceId = manualWorkspaceIds[0] ?? [...teamWorkspaceIds][0];
  if (!primaryWorkspaceId) {
    throw new HTTPException(400, {
      message: "Select at least one workspace or team",
    });
  }

  const invitation = await auth.api.createInvitation({
    body: {
      email,
      role: input.role || "member",
      organizationId: primaryWorkspaceId,
    },
    headers,
  });

  try {
    const workspaceRows = workspaces.map((workspace) => ({
      invitationId: invitation.id,
      workspaceId: workspace.workspaceId,
      allProjects: workspace.allProjects,
    }));
    if (workspaceRows.length > 0) {
      await db
        .insert(schema.invitationWorkspaceGrantTable)
        .values(workspaceRows);
    }

    const projectRows = workspaces.flatMap((workspace) =>
      workspace.projectIds.map((projectId) => ({
        invitationId: invitation.id,
        projectId,
      })),
    );
    if (projectRows.length > 0) {
      await db.insert(schema.invitationProjectGrantTable).values(projectRows);
    }

    const teamRows = input.teamIds.map((teamId) => ({
      invitationId: invitation.id,
      teamId,
    }));
    if (teamRows.length > 0) {
      await db.insert(schema.invitationTeamTable).values(teamRows);
    }
  } catch (error) {
    // Without its scope rows the invitation would grant the primary workspace
    // in full at acceptance; drop it rather than leave a widened invitation.
    await db
      .delete(schema.invitationTable)
      .where(eq(schema.invitationTable.id, invitation.id));
    console.error("Failed to store invitation scope", invitation.id, error);
    throw new HTTPException(500, {
      message: "Failed to store the invitation scope",
    });
  }

  return {
    id: invitation.id,
    email: invitation.email,
    status: invitation.status,
    expiresAt: new Date(invitation.expiresAt),
    workspaceCount: allWorkspaceIds.length,
    teamCount: input.teamIds.length,
  };
}
