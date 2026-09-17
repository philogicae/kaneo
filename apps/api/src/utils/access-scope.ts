import { and, eq, inArray, or } from "drizzle-orm";
import db, { schema } from "../database";
import { isInstanceAdminUser } from "./is-instance-admin";

export type WorkspaceAccessLevel = "none" | "scoped" | "full";

// Roles that always keep full workspace visibility, so a workspace admin can
// still administer every project of the workspace it manages.
const FULL_ACCESS_ROLES = new Set(["owner", "admin"]);

async function hasFullWorkspaceGrant(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const [directGrant] = await db
    .select({ id: schema.userWorkspaceAccessTable.id })
    .from(schema.userWorkspaceAccessTable)
    .where(
      and(
        eq(schema.userWorkspaceAccessTable.userId, userId),
        eq(schema.userWorkspaceAccessTable.workspaceId, workspaceId),
        eq(schema.userWorkspaceAccessTable.allProjects, true),
      ),
    )
    .limit(1);
  if (directGrant) return true;

  const [teamGrant] = await db
    .select({ id: schema.accessTeamWorkspaceTable.id })
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
        eq(schema.accessTeamMemberTable.userId, userId),
        eq(schema.accessTeamWorkspaceTable.workspaceId, workspaceId),
        eq(schema.accessTeamWorkspaceTable.allProjects, true),
      ),
    )
    .limit(1);

  return Boolean(teamGrant);
}

async function hasDirectWorkspaceGrant(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const [grant] = await db
    .select({ id: schema.userWorkspaceAccessTable.id })
    .from(schema.userWorkspaceAccessTable)
    .where(
      and(
        eq(schema.userWorkspaceAccessTable.userId, userId),
        eq(schema.userWorkspaceAccessTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  return Boolean(grant);
}

async function hasTeamWorkspaceGrant(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const [grant] = await db
    .select({ id: schema.accessTeamWorkspaceTable.id })
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
        eq(schema.accessTeamMemberTable.userId, userId),
        eq(schema.accessTeamWorkspaceTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  return Boolean(grant);
}

// Project rows are only consulted for scoped members; a grant that covers all
// projects of the workspace makes the workspace-level check return "full".
async function hasExplicitProjectGrant(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const [directGrant] = await db
    .select({ id: schema.userProjectAccessTable.id })
    .from(schema.userProjectAccessTable)
    .where(
      and(
        eq(schema.userProjectAccessTable.userId, userId),
        eq(schema.userProjectAccessTable.projectId, projectId),
      ),
    )
    .limit(1);
  if (directGrant) return true;

  const [teamGrant] = await db
    .select({ id: schema.accessTeamProjectTable.id })
    .from(schema.accessTeamProjectTable)
    .innerJoin(
      schema.accessTeamMemberTable,
      eq(
        schema.accessTeamMemberTable.teamId,
        schema.accessTeamProjectTable.teamId,
      ),
    )
    .where(
      and(
        eq(schema.accessTeamMemberTable.userId, userId),
        eq(schema.accessTeamProjectTable.projectId, projectId),
      ),
    )
    .limit(1);

  return Boolean(teamGrant);
}

export async function getWorkspaceAccessLevel(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceAccessLevel> {
  if (await isInstanceAdminUser(userId)) {
    return "full";
  }

  const [membership] = await db
    .select({
      role: schema.workspaceUserTable.role,
      accessScope: schema.workspaceUserTable.accessScope,
    })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.userId, userId),
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (membership) {
    if (
      membership.accessScope !== "scoped" ||
      FULL_ACCESS_ROLES.has(membership.role)
    ) {
      return "full";
    }
    return (await hasFullWorkspaceGrant(userId, workspaceId))
      ? "full"
      : "scoped";
  }

  if (await hasFullWorkspaceGrant(userId, workspaceId)) {
    return "full";
  }
  if (
    (await hasDirectWorkspaceGrant(userId, workspaceId)) ||
    (await hasTeamWorkspaceGrant(userId, workspaceId))
  ) {
    return "scoped";
  }

  // A project-only grant still opens the workspace for reading that project.
  const [projectGrant] = await db
    .select({ id: schema.userProjectAccessTable.id })
    .from(schema.userProjectAccessTable)
    .innerJoin(
      schema.projectTable,
      eq(schema.projectTable.id, schema.userProjectAccessTable.projectId),
    )
    .where(
      and(
        eq(schema.userProjectAccessTable.userId, userId),
        eq(schema.projectTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (projectGrant) return "scoped";

  const [teamProjectGrant] = await db
    .select({ id: schema.accessTeamProjectTable.id })
    .from(schema.accessTeamProjectTable)
    .innerJoin(
      schema.projectTable,
      eq(schema.projectTable.id, schema.accessTeamProjectTable.projectId),
    )
    .innerJoin(
      schema.accessTeamMemberTable,
      eq(
        schema.accessTeamMemberTable.teamId,
        schema.accessTeamProjectTable.teamId,
      ),
    )
    .where(
      and(
        eq(schema.accessTeamMemberTable.userId, userId),
        eq(schema.projectTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  return teamProjectGrant ? "scoped" : "none";
}

export async function canAccessProject(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const [project] = await db
    .select({ workspaceId: schema.projectTable.workspaceId })
    .from(schema.projectTable)
    .where(eq(schema.projectTable.id, projectId))
    .limit(1);
  if (!project) return false;

  const level = await getWorkspaceAccessLevel(userId, project.workspaceId);
  if (level === "full") return true;
  if (level === "none") return false;

  return hasExplicitProjectGrant(userId, projectId);
}

// null means "no project restriction" (full workspace access).
export async function getScopedProjectIds(
  userId: string,
  workspaceId: string,
): Promise<string[] | null> {
  const level = await getWorkspaceAccessLevel(userId, workspaceId);
  if (level === "full") return null;
  if (level === "none") return [];

  const ids = new Set<string>();

  const directGrants = await db
    .select({ projectId: schema.userProjectAccessTable.projectId })
    .from(schema.userProjectAccessTable)
    .innerJoin(
      schema.projectTable,
      eq(schema.projectTable.id, schema.userProjectAccessTable.projectId),
    )
    .where(
      and(
        eq(schema.userProjectAccessTable.userId, userId),
        eq(schema.projectTable.workspaceId, workspaceId),
      ),
    );
  for (const row of directGrants) ids.add(row.projectId);

  const teamGrants = await db
    .select({ projectId: schema.accessTeamProjectTable.projectId })
    .from(schema.accessTeamProjectTable)
    .innerJoin(
      schema.projectTable,
      eq(schema.projectTable.id, schema.accessTeamProjectTable.projectId),
    )
    .innerJoin(
      schema.accessTeamMemberTable,
      eq(
        schema.accessTeamMemberTable.teamId,
        schema.accessTeamProjectTable.teamId,
      ),
    )
    .where(
      and(
        eq(schema.accessTeamMemberTable.userId, userId),
        eq(schema.projectTable.workspaceId, workspaceId),
      ),
    );
  for (const row of teamGrants) ids.add(row.projectId);

  return [...ids];
}

// Workspaces where the user sees every project, for query-level filtering
// (search). Includes team and direct "all projects" grants so a grant without
// a membership row still opens the whole workspace.
export async function getFullAccessWorkspaceIds(
  userId: string,
): Promise<string[]> {
  if (await isInstanceAdminUser(userId)) {
    const workspaces = await db
      .select({ id: schema.workspaceTable.id })
      .from(schema.workspaceTable);
    return workspaces.map((workspace) => workspace.id);
  }

  const memberships = await db
    .select({ workspaceId: schema.workspaceUserTable.workspaceId })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.userId, userId),
        or(
          eq(schema.workspaceUserTable.accessScope, "full"),
          inArray(schema.workspaceUserTable.role, ["owner", "admin"]),
        ),
      ),
    );

  const directGrants = await db
    .select({ workspaceId: schema.userWorkspaceAccessTable.workspaceId })
    .from(schema.userWorkspaceAccessTable)
    .where(
      and(
        eq(schema.userWorkspaceAccessTable.userId, userId),
        eq(schema.userWorkspaceAccessTable.allProjects, true),
      ),
    );

  const teamGrants = await db
    .select({ workspaceId: schema.accessTeamWorkspaceTable.workspaceId })
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
        eq(schema.accessTeamMemberTable.userId, userId),
        eq(schema.accessTeamWorkspaceTable.allProjects, true),
      ),
    );

  return [
    ...new Set([
      ...memberships.map((row) => row.workspaceId),
      ...directGrants.map((row) => row.workspaceId),
      ...teamGrants.map((row) => row.workspaceId),
    ]),
  ];
}

export async function getExplicitProjectGrantIds(
  userId: string,
): Promise<string[]> {
  const directGrants = await db
    .select({ projectId: schema.userProjectAccessTable.projectId })
    .from(schema.userProjectAccessTable)
    .where(eq(schema.userProjectAccessTable.userId, userId));

  const teamGrants = await db
    .select({ projectId: schema.accessTeamProjectTable.projectId })
    .from(schema.accessTeamProjectTable)
    .innerJoin(
      schema.accessTeamMemberTable,
      eq(
        schema.accessTeamMemberTable.teamId,
        schema.accessTeamProjectTable.teamId,
      ),
    )
    .where(eq(schema.accessTeamMemberTable.userId, userId));

  return [
    ...new Set([
      ...directGrants.map((row) => row.projectId),
      ...teamGrants.map((row) => row.projectId),
    ]),
  ];
}
