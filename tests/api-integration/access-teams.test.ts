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

function jsonRequest(body: unknown) {
  return {
    method: "POST",
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
});
