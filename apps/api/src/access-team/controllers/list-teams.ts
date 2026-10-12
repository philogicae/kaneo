import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { getAdministeredWorkspaceIds } from "../../utils/access-grants";
import { canViewTeam, serializeTeam } from "./team-helpers";

export type SerializedTeam = NonNullable<
  Awaited<ReturnType<typeof serializeTeam>>
>;

// Teams visible to the caller: everything for instance admins, the teams whose
// scope intersects a workspace they administer, and the teams they belong to.
export default async function listTeams(
  userId: string,
  workspaceId?: string,
): Promise<SerializedTeam[]> {
  const teams = await db
    .select({
      id: schema.accessTeamTable.id,
      name: schema.accessTeamTable.name,
    })
    .from(schema.accessTeamTable);

  const visible: SerializedTeam[] = [];
  for (const team of teams) {
    if (!(await canViewTeam(userId, team.id))) continue;
    const serialized = await serializeTeam(team.id, userId);
    if (!serialized) continue;
    if (
      workspaceId &&
      !serialized.workspaces.some(
        (workspace) => workspace.workspaceId === workspaceId,
      )
    ) {
      continue;
    }
    visible.push(serialized);
  }

  return visible.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTeam(teamId: string, userId: string) {
  const [team] = await db
    .select({ id: schema.accessTeamTable.id })
    .from(schema.accessTeamTable)
    .where(eq(schema.accessTeamTable.id, teamId))
    .limit(1);
  if (!team) return null;

  if (!(await canViewTeam(userId, team.id))) return null;
  return serializeTeam(team.id, userId);
}

// Workspaces the caller may grant access to (all workspaces for instance
// admins), with their projects, for the access-scope editors.
export async function listManageableWorkspaces(userId: string) {
  const administered = await getAdministeredWorkspaceIds(userId);
  const workspaceRows = await db
    .select({
      id: schema.workspaceTable.id,
      name: schema.workspaceTable.name,
      slug: schema.workspaceTable.slug,
    })
    .from(schema.workspaceTable)
    .orderBy(schema.workspaceTable.name);

  const visible = workspaceRows.filter(
    (workspace) => administered === null || administered.includes(workspace.id),
  );
  if (visible.length === 0) return [];

  const projectRows = await db
    .select({
      id: schema.projectTable.id,
      name: schema.projectTable.name,
      slug: schema.projectTable.slug,
      workspaceId: schema.projectTable.workspaceId,
    })
    .from(schema.projectTable)
    .orderBy(schema.projectTable.name);

  return visible.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    projects: projectRows
      .filter((project) => project.workspaceId === workspace.id)
      .map((project) => ({
        id: project.id,
        name: project.name,
        slug: project.slug,
      })),
  }));
}
