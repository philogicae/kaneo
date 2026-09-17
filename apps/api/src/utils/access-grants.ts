import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";

type GrantContext = {
  grantedBy?: string | null;
};

export async function ensureScopedWorkspaceMembership(
  userId: string,
  workspaceId: string,
  role = "member",
): Promise<void> {
  const [existing] = await db
    .select({
      id: schema.workspaceUserTable.id,
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

  if (existing) {
    // Never narrow an existing full membership: a former invitee keeps the
    // access they were granted through a whole-workspace invitation.
    return;
  }

  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId,
    role,
    accessScope: "scoped",
    joinedAt: new Date(),
  });
}

export async function markWorkspaceMembershipScoped(
  userId: string,
  workspaceId: string,
): Promise<void> {
  await db
    .update(schema.workspaceUserTable)
    .set({ accessScope: "scoped" })
    .where(
      and(
        eq(schema.workspaceUserTable.userId, userId),
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.role, "member"),
      ),
    );
}

export async function addTeamMember(
  userId: string,
  teamId: string,
): Promise<void> {
  const [existing] = await db
    .select({ id: schema.accessTeamMemberTable.id })
    .from(schema.accessTeamMemberTable)
    .where(
      and(
        eq(schema.accessTeamMemberTable.teamId, teamId),
        eq(schema.accessTeamMemberTable.userId, userId),
      ),
    )
    .limit(1);
  if (existing) return;

  await db.insert(schema.accessTeamMemberTable).values({ teamId, userId });

  // Materialise a scoped membership for every workspace the team covers so
  // role resolution, the sidebar and the workspace list keep working.
  const workspaces = await db
    .select({ workspaceId: schema.accessTeamWorkspaceTable.workspaceId })
    .from(schema.accessTeamWorkspaceTable)
    .where(eq(schema.accessTeamWorkspaceTable.teamId, teamId));

  for (const workspace of workspaces) {
    await ensureScopedWorkspaceMembership(userId, workspace.workspaceId);
  }
}

// A scoped membership is only removed when no other source (team, direct
// grant, full invitation) still justifies it.
export async function cleanupOrphanedScopedMembership(
  userId: string,
  workspaceId: string,
): Promise<void> {
  const [membership] = await db
    .select({
      id: schema.workspaceUserTable.id,
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

  if (membership?.accessScope !== "scoped") return;
  if (membership.role !== "member") return;

  const [directWorkspaceGrant] = await db
    .select({ id: schema.userWorkspaceAccessTable.id })
    .from(schema.userWorkspaceAccessTable)
    .where(
      and(
        eq(schema.userWorkspaceAccessTable.userId, userId),
        eq(schema.userWorkspaceAccessTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (directWorkspaceGrant) return;

  const [teamWorkspaceGrant] = await db
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
  if (teamWorkspaceGrant) return;

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
  if (projectGrant) return;

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
  if (teamProjectGrant) return;

  await db
    .delete(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.userId, userId),
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
      ),
    );
}

export async function removeTeamMember(
  userId: string,
  teamId: string,
): Promise<void> {
  const workspaces = await db
    .select({ workspaceId: schema.accessTeamWorkspaceTable.workspaceId })
    .from(schema.accessTeamWorkspaceTable)
    .where(eq(schema.accessTeamWorkspaceTable.teamId, teamId));

  await db
    .delete(schema.accessTeamMemberTable)
    .where(
      and(
        eq(schema.accessTeamMemberTable.teamId, teamId),
        eq(schema.accessTeamMemberTable.userId, userId),
      ),
    );

  for (const workspace of workspaces) {
    await cleanupOrphanedScopedMembership(userId, workspace.workspaceId);
  }
}

export async function deleteTeamGrantCleanup(
  teamId: string,
  workspaceIds: string[],
  memberIds: string[],
): Promise<void> {
  await db
    .delete(schema.accessTeamTable)
    .where(eq(schema.accessTeamTable.id, teamId));

  for (const userId of memberIds) {
    for (const workspaceId of workspaceIds) {
      await cleanupOrphanedScopedMembership(userId, workspaceId);
    }
  }
}

// Applies everything an invitation granted once it is accepted: teams become
// live memberships (so later team edits keep flowing) and manual grants become
// direct per-user rows.
export async function materializeInvitationGrants(
  userId: string,
  invitationId: string,
  context: GrantContext = {},
): Promise<void> {
  const teamRows = await db
    .select({ teamId: schema.invitationTeamTable.teamId })
    .from(schema.invitationTeamTable)
    .where(eq(schema.invitationTeamTable.invitationId, invitationId));

  for (const row of teamRows) {
    await addTeamMember(userId, row.teamId);
  }

  const workspaceRows = await db
    .select({
      workspaceId: schema.invitationWorkspaceGrantTable.workspaceId,
      allProjects: schema.invitationWorkspaceGrantTable.allProjects,
    })
    .from(schema.invitationWorkspaceGrantTable)
    .where(eq(schema.invitationWorkspaceGrantTable.invitationId, invitationId));

  for (const row of workspaceRows) {
    await ensureScopedWorkspaceMembership(userId, row.workspaceId);
    if (row.allProjects) {
      // "All projects of this workspace" is the one case where the manual
      // grant lifts the membership back to full access.
      await db
        .update(schema.workspaceUserTable)
        .set({ accessScope: "full" })
        .where(
          and(
            eq(schema.workspaceUserTable.userId, userId),
            eq(schema.workspaceUserTable.workspaceId, row.workspaceId),
            eq(schema.workspaceUserTable.role, "member"),
          ),
        );
      await upsertWorkspaceGrant(userId, row.workspaceId, true, context);
      continue;
    }
    await markWorkspaceMembershipScoped(userId, row.workspaceId);
    await upsertWorkspaceGrant(userId, row.workspaceId, false, context);
  }

  const projectRows = await db
    .select({
      projectId: schema.invitationProjectGrantTable.projectId,
    })
    .from(schema.invitationProjectGrantTable)
    .where(eq(schema.invitationProjectGrantTable.invitationId, invitationId));

  if (projectRows.length > 0) {
    const projects = await db
      .select({
        id: schema.projectTable.id,
        workspaceId: schema.projectTable.workspaceId,
      })
      .from(schema.projectTable)
      .where(
        inArray(
          schema.projectTable.id,
          projectRows.map((row) => row.projectId),
        ),
      );

    for (const project of projects) {
      await ensureScopedWorkspaceMembership(userId, project.workspaceId);
      await markWorkspaceMembershipScoped(userId, project.workspaceId);
      await upsertProjectGrant(userId, project.id, context);
    }
  }
}

async function upsertWorkspaceGrant(
  userId: string,
  workspaceId: string,
  allProjects: boolean,
  context: GrantContext,
): Promise<void> {
  const [existing] = await db
    .select({
      id: schema.userWorkspaceAccessTable.id,
      allProjects: schema.userWorkspaceAccessTable.allProjects,
    })
    .from(schema.userWorkspaceAccessTable)
    .where(
      and(
        eq(schema.userWorkspaceAccessTable.userId, userId),
        eq(schema.userWorkspaceAccessTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (existing) {
    if (allProjects && !existing.allProjects) {
      await db
        .update(schema.userWorkspaceAccessTable)
        .set({ allProjects: true })
        .where(eq(schema.userWorkspaceAccessTable.id, existing.id));
    }
    return;
  }

  await db.insert(schema.userWorkspaceAccessTable).values({
    userId,
    workspaceId,
    allProjects,
    grantedBy: context.grantedBy ?? null,
  });
}

async function upsertProjectGrant(
  userId: string,
  projectId: string,
  context: GrantContext,
): Promise<void> {
  const [existing] = await db
    .select({ id: schema.userProjectAccessTable.id })
    .from(schema.userProjectAccessTable)
    .where(
      and(
        eq(schema.userProjectAccessTable.userId, userId),
        eq(schema.userProjectAccessTable.projectId, projectId),
      ),
    )
    .limit(1);
  if (existing) return;

  await db.insert(schema.userProjectAccessTable).values({
    userId,
    projectId,
    grantedBy: context.grantedBy ?? null,
  });
}

// Workspaces where the user can administer every project, used for team and
// invitation governance. null means instance-wide (bypass).
export async function getAdministeredWorkspaceIds(
  userId: string,
): Promise<string[] | null> {
  const [row] = await db
    .select({ role: schema.userTable.role })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId))
    .limit(1);
  if (row?.role === "admin") return null;

  const memberships = await db
    .select({ workspaceId: schema.workspaceUserTable.workspaceId })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.userId, userId),
        inArray(schema.workspaceUserTable.role, ["owner", "admin"]),
      ),
    );

  return memberships.map((membership) => membership.workspaceId);
}

export async function canAdministerWorkspaces(
  userId: string,
  workspaceIds: string[],
): Promise<boolean> {
  const administered = await getAdministeredWorkspaceIds(userId);
  if (administered === null) return true;
  return workspaceIds.every((workspaceId) =>
    administered.includes(workspaceId),
  );
}

export async function assertCanManageWorkspaces(
  userId: string,
  workspaceIds: string[],
): Promise<void> {
  const administered = await getAdministeredWorkspaceIds(userId);
  if (administered === null) return;

  const allowed = workspaceIds.every((workspaceId) =>
    administered.includes(workspaceId),
  );
  if (!allowed) {
    throw new HTTPException(403, {
      message: "You must administer every workspace in the scope to manage it",
    });
  }
}

// Cleanup helper for scope edits: rewrites the rows a team or invitation
// covers.
export async function replaceTeamScope(
  teamId: string,
  workspaces: Array<{
    workspaceId: string;
    allProjects: boolean;
    projectIds: string[];
  }>,
): Promise<void> {
  await db
    .delete(schema.accessTeamProjectTable)
    .where(eq(schema.accessTeamProjectTable.teamId, teamId));
  await db
    .delete(schema.accessTeamWorkspaceTable)
    .where(eq(schema.accessTeamWorkspaceTable.teamId, teamId));

  for (const workspace of workspaces) {
    await db.insert(schema.accessTeamWorkspaceTable).values({
      teamId,
      workspaceId: workspace.workspaceId,
      allProjects: workspace.allProjects,
    });
    if (!workspace.allProjects) {
      for (const projectId of workspace.projectIds) {
        await db
          .insert(schema.accessTeamProjectTable)
          .values({ teamId, projectId });
      }
    }
  }
}

// Users that keep a scoped membership only because of this team, so scope
// edits and deletions can revoke it.
export async function getTeamMemberIds(teamId: string): Promise<string[]> {
  const members = await db
    .select({ userId: schema.accessTeamMemberTable.userId })
    .from(schema.accessTeamMemberTable)
    .where(eq(schema.accessTeamMemberTable.teamId, teamId));
  return members.map((member) => member.userId);
}

export async function getTeamWorkspaceIds(teamId: string): Promise<string[]> {
  const workspaces = await db
    .select({ workspaceId: schema.accessTeamWorkspaceTable.workspaceId })
    .from(schema.accessTeamWorkspaceTable)
    .where(eq(schema.accessTeamWorkspaceTable.teamId, teamId));
  return workspaces.map((workspace) => workspace.workspaceId);
}

export async function getWorkspaceProjectIds(
  workspaceId: string,
): Promise<string[]> {
  const projects = await db
    .select({ id: schema.projectTable.id })
    .from(schema.projectTable)
    .where(eq(schema.projectTable.workspaceId, workspaceId));
  return projects.map((project) => project.id);
}
