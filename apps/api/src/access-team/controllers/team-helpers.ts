import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import {
  assertCanManageWorkspaces,
  getAdministeredWorkspaceIds,
  getTeamMemberIds,
  getTeamWorkspaceIds,
} from "../../utils/access-grants";

export type TeamScopeInput = {
  workspaceId: string;
  allProjects: boolean;
  projectIds?: string[];
};

export async function validateTeamScope(workspaces: TeamScopeInput[]) {
  const seen = new Set<string>();

  for (const workspace of workspaces) {
    if (seen.has(workspace.workspaceId)) {
      throw new HTTPException(400, {
        message: "A workspace can only appear once in the scope",
      });
    }
    seen.add(workspace.workspaceId);

    const [existing] = await db
      .select({ id: schema.workspaceTable.id })
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, workspace.workspaceId))
      .limit(1);
    if (!existing) {
      throw new HTTPException(400, {
        message: "Unknown workspace in the scope",
      });
    }

    if (workspace.allProjects) continue;

    const projectIds = workspace.projectIds ?? [];
    if (projectIds.length === 0) {
      throw new HTTPException(400, {
        message:
          "At least one project is required when the team does not cover all projects of a workspace",
      });
    }

    const projects = await db
      .select({
        id: schema.projectTable.id,
        workspaceId: schema.projectTable.workspaceId,
      })
      .from(schema.projectTable)
      .where(inArray(schema.projectTable.id, projectIds));

    if (projects.length !== new Set(projectIds).size) {
      throw new HTTPException(400, {
        message: "Unknown project in the scope",
      });
    }
    if (
      projects.some((project) => project.workspaceId !== workspace.workspaceId)
    ) {
      throw new HTTPException(400, {
        message: "A project does not belong to its workspace",
      });
    }
  }
}

export async function assertCanManageScope(
  userId: string,
  workspaces: TeamScopeInput[],
): Promise<void> {
  await assertCanManageWorkspaces(
    userId,
    workspaces.map((workspace) => workspace.workspaceId),
  );
}

export async function isTeamMember(
  userId: string,
  teamId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.accessTeamMemberTable.id })
    .from(schema.accessTeamMemberTable)
    .where(
      and(
        eq(schema.accessTeamMemberTable.teamId, teamId),
        eq(schema.accessTeamMemberTable.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function canViewTeam(
  userId: string,
  teamId: string,
): Promise<boolean> {
  const administered = await getAdministeredWorkspaceIds(userId);
  if (administered === null) return true;
  if (await isTeamMember(userId, teamId)) return true;

  const workspaces = await getTeamWorkspaceIds(teamId);
  return workspaces.some((workspaceId) => administered.includes(workspaceId));
}

export async function serializeTeam(teamId: string, userId: string) {
  const [team] = await db
    .select()
    .from(schema.accessTeamTable)
    .where(eq(schema.accessTeamTable.id, teamId))
    .limit(1);
  if (!team) return null;

  const workspaceRows = await db
    .select({
      workspaceId: schema.accessTeamWorkspaceTable.workspaceId,
      workspaceName: schema.workspaceTable.name,
      allProjects: schema.accessTeamWorkspaceTable.allProjects,
    })
    .from(schema.accessTeamWorkspaceTable)
    .innerJoin(
      schema.workspaceTable,
      eq(schema.workspaceTable.id, schema.accessTeamWorkspaceTable.workspaceId),
    )
    .where(eq(schema.accessTeamWorkspaceTable.teamId, teamId));

  const projectRows = await db
    .select({
      projectId: schema.accessTeamProjectTable.projectId,
      projectName: schema.projectTable.name,
      projectSlug: schema.projectTable.slug,
      workspaceId: schema.projectTable.workspaceId,
    })
    .from(schema.accessTeamProjectTable)
    .innerJoin(
      schema.projectTable,
      eq(schema.projectTable.id, schema.accessTeamProjectTable.projectId),
    )
    .where(eq(schema.accessTeamProjectTable.teamId, teamId));

  const memberRows = await db
    .select({
      userId: schema.accessTeamMemberTable.userId,
      name: schema.userTable.name,
      email: schema.userTable.email,
    })
    .from(schema.accessTeamMemberTable)
    .innerJoin(
      schema.userTable,
      eq(schema.userTable.id, schema.accessTeamMemberTable.userId),
    )
    .where(eq(schema.accessTeamMemberTable.teamId, teamId));

  const administered = await getAdministeredWorkspaceIds(userId);
  const canManage =
    administered === null ||
    workspaceRows.every((workspace) =>
      administered.includes(workspace.workspaceId),
    );

  return {
    id: team.id,
    name: team.name,
    description: team.description,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    canManage,
    workspaces: workspaceRows.map((workspace) => ({
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.workspaceName,
      allProjects: workspace.allProjects,
      projects: projectRows
        .filter((project) => project.workspaceId === workspace.workspaceId)
        .map((project) => ({
          id: project.projectId,
          name: project.projectName,
          slug: project.projectSlug,
        })),
    })),
    members: memberRows,
  };
}

export { getTeamMemberIds, getTeamWorkspaceIds };
