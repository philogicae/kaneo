import { and, eq, inArray } from "drizzle-orm";
import db, { schema } from "../../database";

// Members an assignee or mention picker may offer for a project: everyone who
// can open it (full workspace access, or a scoped membership with an explicit
// grant) plus instance admins, who bypass project scope.
async function getProjectMembers(projectId: string) {
  const [project] = await db
    .select({ workspaceId: schema.projectTable.workspaceId })
    .from(schema.projectTable)
    .where(eq(schema.projectTable.id, projectId))
    .limit(1);

  if (!project) return [];

  const members = await db
    .select({
      id: schema.userTable.id,
      name: schema.userTable.name,
      email: schema.userTable.email,
      image: schema.userTable.image,
      role: schema.workspaceUserTable.role,
      accessScope: schema.workspaceUserTable.accessScope,
    })
    .from(schema.workspaceUserTable)
    .innerJoin(
      schema.userTable,
      eq(schema.workspaceUserTable.userId, schema.userTable.id),
    )
    .where(eq(schema.workspaceUserTable.workspaceId, project.workspaceId));

  const workspaceId = project.workspaceId;

  const fullWorkspaceGrants = await db
    .select({ userId: schema.userWorkspaceAccessTable.userId })
    .from(schema.userWorkspaceAccessTable)
    .where(
      and(
        eq(schema.userWorkspaceAccessTable.workspaceId, workspaceId),
        eq(schema.userWorkspaceAccessTable.allProjects, true),
      ),
    );

  const teamWorkspaceGrants = await db
    .select({ userId: schema.accessTeamMemberTable.userId })
    .from(schema.accessTeamWorkspaceTable)
    .innerJoin(
      schema.accessTeamMemberTable,
      eq(
        schema.accessTeamMemberTable.teamId,
        schema.accessTeamWorkspaceTable.teamId,
      ),
    )
    .where(
      and(
        eq(schema.accessTeamWorkspaceTable.workspaceId, workspaceId),
        eq(schema.accessTeamWorkspaceTable.allProjects, true),
      ),
    );

  const directProjectGrants = await db
    .select({ userId: schema.userProjectAccessTable.userId })
    .from(schema.userProjectAccessTable)
    .where(eq(schema.userProjectAccessTable.projectId, projectId));

  const teamProjectGrants = await db
    .select({ userId: schema.accessTeamMemberTable.userId })
    .from(schema.accessTeamProjectTable)
    .innerJoin(
      schema.accessTeamMemberTable,
      eq(
        schema.accessTeamMemberTable.teamId,
        schema.accessTeamProjectTable.teamId,
      ),
    )
    .where(eq(schema.accessTeamProjectTable.projectId, projectId));

  const fullAccessUserIds = new Set([
    ...fullWorkspaceGrants.map((row) => row.userId),
    ...teamWorkspaceGrants.map((row) => row.userId),
  ]);
  const scopedUserIds = new Set([
    ...directProjectGrants.map((row) => row.userId),
    ...teamProjectGrants.map((row) => row.userId),
  ]);

  const allowed = members.filter(
    (member) =>
      member.accessScope !== "scoped" ||
      member.role === "owner" ||
      member.role === "admin" ||
      fullAccessUserIds.has(member.id) ||
      scopedUserIds.has(member.id),
  );

  const memberIds = new Set(allowed.map((member) => member.id));
  const adminIds = new Set(
    (
      await db
        .select({ id: schema.userTable.id })
        .from(schema.userTable)
        .where(eq(schema.userTable.role, "admin"))
    ).map((row) => row.id),
  );

  const extraAdmins = [...adminIds].filter((id) => !memberIds.has(id));
  if (extraAdmins.length > 0) {
    const admins = await db
      .select({
        id: schema.userTable.id,
        name: schema.userTable.name,
        email: schema.userTable.email,
        image: schema.userTable.image,
      })
      .from(schema.userTable)
      .where(inArray(schema.userTable.id, extraAdmins));
    for (const admin of admins) {
      allowed.push({ ...admin, role: "admin", accessScope: "full" });
    }
  }

  return allowed.map(({ accessScope: _accessScope, ...member }) => member);
}

export default getProjectMembers;
