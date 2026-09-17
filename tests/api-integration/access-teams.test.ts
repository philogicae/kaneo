import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { materializeInvitationGrants } from "../../apps/api/src/utils/access-grants";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type App = ReturnType<typeof createApp>["app"];

function jsonRequest(body: unknown, method = "POST") {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function createTeam(
  app: App,
  body: {
    name: string;
    workspaces: Array<{
      workspaceId: string;
      allProjects: boolean;
      projectIds?: string[];
    }>;
  },
) {
  return app.request("/api/access-team", jsonRequest(body));
}

async function addTeamMember(app: App, teamId: string, userId: string) {
  return app.request(
    `/api/access-team/${teamId}/members`,
    jsonRequest({ userId }),
  );
}

async function seedTask(projectId: string, title: string) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      title,
      status: "to-do",
      priority: "medium",
      number: Math.floor(Math.random() * 1_000_000),
      position: 1,
    })
    .returning();
  return task;
}

describe("API integration: access teams and scoped access", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("enforces a project-scoped team for its members and cleans up on removal", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const target = await createWorkspaceMember({ role: "member" });
    const { project: alpha } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Alpha",
    });
    const { project: beta } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Beta",
    });
    const { app } = createApp();

    mockAuthenticatedSession(owner.user);
    const created = await createTeam(app, {
      name: "Alpha only",
      workspaces: [
        {
          workspaceId: owner.workspace.id,
          allProjects: false,
          projectIds: [alpha.id],
        },
      ],
    });
    expect(created.status).toBe(200);
    const team = (await created.json()) as { id: string; canManage: boolean };
    expect(team.canManage).toBe(true);

    // Unique names keep the team list unambiguous.
    const duplicate = await createTeam(app, {
      name: "Alpha only",
      workspaces: [{ workspaceId: owner.workspace.id, allProjects: true }],
    });
    expect(duplicate.status).toBe(409);

    // A workspace outside the caller's administration cannot be granted.
    const foreign = await createTeam(app, {
      name: "Foreign",
      workspaces: [{ workspaceId: target.workspace.id, allProjects: true }],
    });
    expect(foreign.status).toBe(403);

    const added = await addTeamMember(app, team.id, target.user.id);
    expect(added.status).toBe(200);

    // The scoped member reaches the workspace but only the granted project.
    vi.restoreAllMocks();
    mockAuthenticatedSession(target.user);

    const list = await app.request(
      `/api/project?workspaceId=${owner.workspace.id}`,
    );
    expect(list.status).toBe(200);
    const projects = (await list.json()) as Array<{ id: string }>;
    expect(projects.map((project) => project.id)).toEqual([alpha.id]);

    const grantedBoard = await app.request(`/api/task/tasks/${alpha.id}`);
    expect(grantedBoard.status).toBe(200);

    const otherBoard = await app.request(`/api/task/tasks/${beta.id}`);
    expect(otherBoard.status).toBe(403);

    const grantedProject = await app.request(`/api/project/${alpha.id}`);
    expect(grantedProject.status).toBe(200);
    const otherProject = await app.request(`/api/project/${beta.id}`);
    expect(otherProject.status).toBe(403);

    // The team membership materialised a scoped workspace membership.
    const [membership] = await db
      .select({
        accessScope: schema.workspaceUserTable.accessScope,
      })
      .from(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.userId, target.user.id),
          eq(schema.workspaceUserTable.workspaceId, owner.workspace.id),
        ),
      );
    expect(membership?.accessScope).toBe("scoped");

    // Removing the member revokes the access this team was the only source of.
    vi.restoreAllMocks();
    mockAuthenticatedSession(owner.user);
    const removed = await app.request(
      `/api/access-team/${team.id}/members/${target.user.id}`,
      { method: "DELETE" },
    );
    expect(removed.status).toBe(200);

    vi.restoreAllMocks();
    mockAuthenticatedSession(target.user);
    const revokedList = await app.request(
      `/api/project?workspaceId=${owner.workspace.id}`,
    );
    expect(revokedList.status).toBe(403);

    const [gone] = await db
      .select({ id: schema.workspaceUserTable.id })
      .from(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.userId, target.user.id),
          eq(schema.workspaceUserTable.workspaceId, owner.workspace.id),
        ),
      );
    expect(gone).toBeUndefined();
  });

  it("grants every current and future project when the team covers all projects", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const target = await createWorkspaceMember({ role: "member" });
    await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Existing",
    });
    const { app } = createApp();

    mockAuthenticatedSession(owner.user);
    const created = await createTeam(app, {
      name: "Whole workspace",
      workspaces: [{ workspaceId: owner.workspace.id, allProjects: true }],
    });
    expect(created.status).toBe(200);
    const team = (await created.json()) as { id: string };
    expect((await addTeamMember(app, team.id, target.user.id)).status).toBe(
      200,
    );

    // A project created after the grant is reachable too (no project copy).
    const { project: late } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Created later",
    });

    vi.restoreAllMocks();
    mockAuthenticatedSession(target.user);
    const list = await app.request(
      `/api/project?workspaceId=${owner.workspace.id}`,
    );
    expect(list.status).toBe(200);
    const projects = (await list.json()) as Array<{ id: string }>;
    expect(projects).toHaveLength(2);
    expect(projects.some((project) => project.id === late.id)).toBe(true);
  });

  it("refuses team management to plain workspace members", async () => {
    const member = await createWorkspaceMember({ role: "member" });
    const { app } = createApp();

    mockAuthenticatedSession(member.user);
    const created = await createTeam(app, {
      name: "Not allowed",
      workspaces: [{ workspaceId: member.workspace.id, allProjects: true }],
    });
    expect(created.status).toBe(403);
  });

  it("stores invitation scope rows and materialises them on acceptance", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const target = await createWorkspaceMember({ role: "member" });
    const { project: alpha } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Alpha",
    });
    const { project: beta } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Beta",
    });
    const { app } = createApp();

    // better-auth owns invitation creation; mock the delivery so the test only
    // covers the scope rows and the acceptance materialisation. The invitation
    // row itself is what better-auth would have persisted before the callback.
    const invitationId = `invitation-${randomUUID()}`;
    await db.insert(schema.invitationTable).values({
      id: invitationId,
      workspaceId: owner.workspace.id,
      inviterId: owner.user.id,
      email: target.user.email,
      role: "member",
      status: "pending",
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    vi.spyOn(auth.api, "createInvitation").mockResolvedValue({
      id: invitationId,
      email: target.user.email,
      role: "member",
      organizationId: owner.workspace.id,
      status: "pending",
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: new Date(),
    } as never);

    mockAuthenticatedSession(owner.user);
    const invitation = await app.request(
      "/api/invitation",
      jsonRequest({
        email: target.user.email,
        workspaces: [
          {
            workspaceId: owner.workspace.id,
            allProjects: false,
            projectIds: [alpha.id],
          },
        ],
        teamIds: [],
      }),
    );
    expect(invitation.status).toBe(200);
    const created = (await invitation.json()) as {
      id: string;
      workspaceCount: number;
    };
    expect(created.id).toBe(invitationId);
    expect(created.workspaceCount).toBe(1);

    const grants = await db
      .select({ id: schema.invitationProjectGrantTable.id })
      .from(schema.invitationProjectGrantTable)
      .where(eq(schema.invitationProjectGrantTable.invitationId, invitationId));
    expect(grants).toHaveLength(1);

    // A plain member cannot invite to a workspace they don't administer.
    vi.restoreAllMocks();
    mockAuthenticatedSession(target.user);
    const refused = await app.request(
      "/api/invitation",
      jsonRequest({
        email: `outsider-${randomUUID()}@example.com`,
        workspaces: [{ workspaceId: owner.workspace.id, allProjects: true }],
        teamIds: [],
      }),
    );
    expect(refused.status).toBe(403);

    // Acceptance materialises the manual grants (the auth hook calls this in
    // production; invoking it directly keeps the test on our code).
    await materializeInvitationGrants(target.user.id, invitationId, {
      grantedBy: owner.user.id,
    });

    const [directGrant] = await db
      .select({ id: schema.userProjectAccessTable.id })
      .from(schema.userProjectAccessTable)
      .where(
        and(
          eq(schema.userProjectAccessTable.userId, target.user.id),
          eq(schema.userProjectAccessTable.projectId, alpha.id),
        ),
      );
    expect(directGrant).toBeDefined();

    mockAuthenticatedSession(target.user);
    const list = await app.request(
      `/api/project?workspaceId=${owner.workspace.id}`,
    );
    expect(list.status).toBe(200);
    const projects = (await list.json()) as Array<{ id: string }>;
    expect(projects.map((project) => project.id)).toEqual([alpha.id]);

    // Search matches the scoped project only.
    await seedTask(alpha.id, "Needle in alpha");
    await seedTask(beta.id, "Needle in beta");
    const search = await app.request(
      `/api/search?q=needle&workspaceId=${owner.workspace.id}`,
    );
    expect(search.status).toBe(200);
    const results = (await search.json()) as {
      results: Array<{ type: string; title: string }>;
    };
    const taskTitles = results.results
      .filter((result) => result.type === "task")
      .map((result) => result.title);
    expect(taskTitles).toEqual(["Needle in alpha"]);
  });

  it("lets instance admins bypass the scope", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const outsider = await createWorkspaceMember({ role: "member" });
    await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Only project",
    });
    const { app } = createApp();

    await db
      .update(schema.userTable)
      .set({ role: "admin" })
      .where(eq(schema.userTable.id, outsider.user.id));

    mockAuthenticatedSession({ ...outsider.user, role: "admin" });
    const list = await app.request(
      `/api/project?workspaceId=${owner.workspace.id}`,
    );
    expect(list.status).toBe(200);
  });

  it("keeps a project created by a scoped member inside their scope", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const target = await createWorkspaceMember({ role: "member" });
    const { project: alpha } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Alpha",
    });
    const { app } = createApp();

    mockAuthenticatedSession(owner.user);
    const created = await createTeam(app, {
      name: "Alpha only",
      workspaces: [
        {
          workspaceId: owner.workspace.id,
          allProjects: false,
          projectIds: [alpha.id],
        },
      ],
    });
    expect(created.status).toBe(200);
    const team = (await created.json()) as { id: string };
    await addTeamMember(app, team.id, target.user.id);

    vi.restoreAllMocks();
    mockAuthenticatedSession(target.user);

    // The member role allows project:create; the new project has no grant yet.
    const response = await app.request(
      "/api/project",
      jsonRequest({
        workspaceId: owner.workspace.id,
        name: "Created by scoped member",
        icon: "Layout",
        slug: "SCOPE",
      }),
    );
    expect(response.status).toBe(200);
    const project = (await response.json()) as { id: string };
    expect(project.id).toBeDefined();

    // The creator keeps access to it: a direct grant is recorded and the
    // project stays in their filtered list.
    const [grant] = await db
      .select({ id: schema.userProjectAccessTable.id })
      .from(schema.userProjectAccessTable)
      .where(
        and(
          eq(schema.userProjectAccessTable.userId, target.user.id),
          eq(schema.userProjectAccessTable.projectId, project.id),
        ),
      );
    expect(grant).toBeDefined();

    const list = await app.request(
      `/api/project?workspaceId=${owner.workspace.id}`,
    );
    expect(list.status).toBe(200);
    const projects = (await list.json()) as Array<{ id: string }>;
    expect(projects.map((entry) => entry.id).sort()).toEqual(
      [alpha.id, project.id].sort(),
    );

    const board = await app.request(`/api/task/tasks/${project.id}`);
    expect(board.status).toBe(200);
  });

  it("grants and revokes direct projects for an existing member", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const target = await createWorkspaceMember({ role: "member" });
    const { project: alpha } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Alpha",
    });
    const { project: beta } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Beta",
    });
    const { app } = createApp();

    mockAuthenticatedSession(owner.user);
    const created = await createTeam(app, {
      name: "Alpha only",
      workspaces: [
        {
          workspaceId: owner.workspace.id,
          allProjects: false,
          projectIds: [alpha.id],
        },
      ],
    });
    expect(created.status).toBe(200);
    const team = (await created.json()) as { id: string };
    await addTeamMember(app, team.id, target.user.id);

    const accessUrl = `/api/workspace/${owner.workspace.id}/members/${target.user.id}/access`;

    // Read: the member only holds the team grant so far.
    const before = await app.request(accessUrl);
    expect(before.status).toBe(200);
    expect(await before.json()).toEqual({
      accessScope: "scoped",
      allProjects: false,
      projectIds: [],
    });

    // A project outside the workspace is rejected.
    const foreign = await app.request(
      accessUrl,
      jsonRequest(
        { allProjects: false, projectIds: ["missing-project"] },
        "PUT",
      ),
    );
    expect(foreign.status).toBe(400);

    // Grant Beta directly, without a team.
    const granted = await app.request(
      accessUrl,
      jsonRequest({ allProjects: false, projectIds: [beta.id] }, "PUT"),
    );
    expect(granted.status).toBe(200);
    expect(await granted.json()).toEqual({
      accessScope: "scoped",
      allProjects: false,
      projectIds: [beta.id],
    });

    // The member reaches both projects now; a scoped member cannot edit.
    vi.restoreAllMocks();
    mockAuthenticatedSession(target.user);
    const list = await app.request(
      `/api/project?workspaceId=${owner.workspace.id}`,
    );
    const ids = ((await list.json()) as Array<{ id: string }>)
      .map((entry) => entry.id)
      .sort();
    expect(ids).toEqual([alpha.id, beta.id].sort());
    expect((await app.request(`/api/task/tasks/${beta.id}`)).status).toBe(200);
    const refused = await app.request(
      accessUrl,
      jsonRequest({ allProjects: true }, "PUT"),
    );
    expect(refused.status).toBe(403);

    // Clearing the direct grants keeps the team-granted project only.
    vi.restoreAllMocks();
    mockAuthenticatedSession(owner.user);
    const cleared = await app.request(
      accessUrl,
      jsonRequest({ allProjects: false, projectIds: [] }, "PUT"),
    );
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toEqual({
      accessScope: "scoped",
      allProjects: false,
      projectIds: [],
    });

    vi.restoreAllMocks();
    mockAuthenticatedSession(target.user);
    const after = await app.request(
      `/api/project?workspaceId=${owner.workspace.id}`,
    );
    expect(
      ((await after.json()) as Array<{ id: string }>).map((entry) => entry.id),
    ).toEqual([alpha.id]);
    expect((await app.request(`/api/task/tasks/${beta.id}`)).status).toBe(403);
  });

  it("scopes assignees, member lists and mentions to project access", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const target = await createWorkspaceMember({ role: "member" });
    const { project: alpha } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Alpha",
    });
    const { project: beta } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Beta",
    });
    const { app } = createApp();

    // The member is scoped to Alpha only, through a team.
    mockAuthenticatedSession(owner.user);
    const created = await createTeam(app, {
      name: "Alpha only",
      workspaces: [
        {
          workspaceId: owner.workspace.id,
          allProjects: false,
          projectIds: [alpha.id],
        },
      ],
    });
    expect(created.status).toBe(200);
    const team = (await created.json()) as { id: string };
    await addTeamMember(app, team.id, target.user.id);

    // The picker endpoint offers the member on Alpha, not on Beta.
    const alphaMembers = await app.request(`/api/project/${alpha.id}/members`);
    expect(alphaMembers.status).toBe(200);
    const alphaIds = ((await alphaMembers.json()) as Array<{ id: string }>).map(
      (member) => member.id,
    );
    expect(alphaIds).toContain(target.user.id);

    const betaMembers = await app.request(`/api/project/${beta.id}/members`);
    expect(betaMembers.status).toBe(200);
    const betaIds = ((await betaMembers.json()) as Array<{ id: string }>).map(
      (member) => member.id,
    );
    expect(betaIds).not.toContain(target.user.id);

    // Assigning the member on Beta is refused, and allowed on Alpha.
    const refused = await app.request(
      `/api/task/${beta.id}`,
      jsonRequest({
        title: "Outside the scope",
        description: "",
        priority: "low",
        status: "to-do",
        userId: target.user.id,
      }),
    );
    expect(refused.status).toBe(403);

    const allowed = await app.request(
      `/api/task/${alpha.id}`,
      jsonRequest({
        title: "Inside the scope",
        description: "",
        priority: "low",
        status: "to-do",
        userId: target.user.id,
      }),
    );
    expect(allowed.status).toBe(200);
    const alphaTask = (await allowed.json()) as { id: string };

    // Mentions only notify members who can open the project.
    const betaTask = await seedTask(beta.id, "Beta task");
    const mention = `<kaneo-mention id="${target.user.id}">Target</kaneo-mention>`;

    const betaComment = await app.request(
      "/api/activity/comment",
      jsonRequest({ taskId: betaTask.id, comment: `Hello ${mention}` }),
    );
    expect(betaComment.status).toBe(200);
    const afterBeta = await db
      .select({ id: schema.notificationTable.id })
      .from(schema.notificationTable)
      .where(
        and(
          eq(schema.notificationTable.userId, target.user.id),
          eq(schema.notificationTable.type, "task_mention"),
        ),
      );
    expect(afterBeta).toHaveLength(0);

    const alphaComment = await app.request(
      "/api/activity/comment",
      jsonRequest({ taskId: alphaTask.id, comment: `Hello ${mention}` }),
    );
    expect(alphaComment.status).toBe(200);
    const afterAlpha = await db
      .select({ id: schema.notificationTable.id })
      .from(schema.notificationTable)
      .where(
        and(
          eq(schema.notificationTable.userId, target.user.id),
          eq(schema.notificationTable.type, "task_mention"),
        ),
      );
    expect(afterAlpha).toHaveLength(1);
  });

  it("lifts a scoped member to full access with an all-projects grant", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const target = await createWorkspaceMember({ role: "member" });
    const { project: alpha } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Alpha",
    });
    const { app } = createApp();

    mockAuthenticatedSession(owner.user);
    const created = await createTeam(app, {
      name: "Alpha only",
      workspaces: [
        {
          workspaceId: owner.workspace.id,
          allProjects: false,
          projectIds: [alpha.id],
        },
      ],
    });
    expect(created.status).toBe(200);
    const team = (await created.json()) as { id: string };
    await addTeamMember(app, team.id, target.user.id);

    const response = await app.request(
      `/api/workspace/${owner.workspace.id}/members/${target.user.id}/access`,
      jsonRequest({ allProjects: true }, "PUT"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accessScope: "full",
      allProjects: true,
      projectIds: [],
    });

    // The grant covers projects created after it.
    const { project: future } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Future",
    });

    vi.restoreAllMocks();
    mockAuthenticatedSession(target.user);
    const list = await app.request(
      `/api/project?workspaceId=${owner.workspace.id}`,
    );
    const ids = ((await list.json()) as Array<{ id: string }>)
      .map((entry) => entry.id)
      .sort();
    expect(ids).toEqual([alpha.id, future.id].sort());
    expect((await app.request(`/api/task/tasks/${future.id}`)).status).toBe(
      200,
    );
  });
});
