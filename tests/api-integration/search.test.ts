import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
});

async function createTaskFixture(
  project: { id: string },
  columns: { todo: { id: string } },
  title: string,
) {
  const { default: db } = await import("../../apps/api/src/database");
  const { schema } = await import("../../apps/api/src/database");
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title,
      status: "to-do",
      columnId: columns.todo.id,
      priority: "medium",
      number: 1,
      position: 1,
    })
    .returning();
  return task;
}

async function createAppointmentFixture(
  project: { id: string },
  title: string,
) {
  const { default: db } = await import("../../apps/api/src/database");
  const { schema } = await import("../../apps/api/src/database");
  const [appointment] = await db
    .insert(schema.appointmentTable)
    .values({
      projectId: project.id,
      title,
      priority: "medium",
      number: 1,
      position: 1,
    })
    .returning();
  return appointment;
}

describe("global search workspace scoping", () => {
  it("searches every workspace the user belongs to when workspaceId is omitted", async () => {
    const first = await createWorkspaceMember({ workspaceName: "Alpha" });
    const second = await createWorkspaceMember({
      userName: "Alpha Owner Two",
      workspaceName: "Beta",
    });
    // Same person in two workspaces: reuse the first user in the second one.
    const { default: db } = await import("../../apps/api/src/database");
    const { schema } = await import("../../apps/api/src/database");
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: second.workspace.id,
      userId: first.user.id,
      role: "member",
      joinedAt: new Date(),
    });

    const firstProject = await createProjectFixture({
      workspaceId: first.workspace.id,
      name: "Aurora",
    });
    const secondProject = await createProjectFixture({
      workspaceId: second.workspace.id,
      name: "Aurora Two",
    });
    await createTaskFixture(
      firstProject.project,
      firstProject.columns,
      "Cinchona wiring",
    );
    await createTaskFixture(
      secondProject.project,
      secondProject.columns,
      "Cinchona testing",
    );

    mockAuthenticatedSession(first.user);
    const { app } = createApp();

    const response = await app.request("/api/search?q=Cinchona&type=tasks");

    expect(response.status).toBe(200);
    const body = (await response.json()) as { results: { id: string }[] };
    expect(body.results).toHaveLength(2);
  });

  it("scopes to the given workspace when workspaceId is provided", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const project = await createProjectFixture({ workspaceId: workspace.id });
    await createTaskFixture(project.project, project.columns, "Quinine fix");

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(
      `/api/search?q=Quinine&type=tasks&workspaceId=${workspace.id}`,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { results: { id: string }[] };
    expect(body.results).toHaveLength(1);
  });

  it("never returns tasks from a workspace the user does not belong to", async () => {
    const outsider = await createWorkspaceMember({ role: "owner" });
    const { user: owner } = await createWorkspaceMember({ role: "owner" });
    const victimWorkspace = outsider.workspace;

    const project = await createProjectFixture({
      workspaceId: victimWorkspace.id,
    });
    await createTaskFixture(project.project, project.columns, "Secret plans");

    mockAuthenticatedSession(owner);
    const { app } = createApp();

    const scoped = await app.request(
      `/api/search?q=Secret&type=tasks&workspaceId=${victimWorkspace.id}`,
    );
    // The middleware still rejects an explicit non-member workspace outright.
    expect(scoped.status).toBe(403);

    const unscoped = await app.request("/api/search?q=Secret&type=tasks");
    expect(unscoped.status).toBe(200);
    expect(((await unscoped.json()) as { results: unknown[] }).results).toEqual(
      [],
    );
  });

  it("keeps the short-id lookup working through the route", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const project = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Aurora",
      slug: "AUR",
    });
    await createTaskFixture(project.project, project.columns, "Fix redirect");

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(
      `/api/search?q=AUR-1&type=tasks&workspaceId=${workspace.id}`,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      results: { taskNumber?: number }[];
    };
    expect(body.results).toHaveLength(1);
    expect(body.results[0]?.taskNumber).toBe(1);
  });
});

describe("global search appointments", () => {
  it("finds appointments by title in all and typed searches", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const project = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Orbit",
      slug: "ORB",
    });
    await createAppointmentFixture(project.project, "Design review");
    await createTaskFixture(project.project, project.columns, "Design brief");

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const all = await app.request(
      `/api/search?q=Design&workspaceId=${workspace.id}`,
    );
    expect(all.status).toBe(200);
    const allResults = (
      (await all.json()) as {
        results: { type: string; title: string; projectId?: string }[];
      }
    ).results;
    expect(allResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "appointment",
          title: "Design review",
          projectId: project.project.id,
        }),
        expect.objectContaining({ type: "task", title: "Design brief" }),
      ]),
    );

    const typed = await app.request(
      `/api/search?q=Design&type=appointments&workspaceId=${workspace.id}`,
    );
    const typedResults = (
      (await typed.json()) as { results: { type: string }[] }
    ).results;
    expect(typedResults).toEqual([
      expect.objectContaining({ type: "appointment" }),
    ]);

    const tasksOnly = await app.request(
      `/api/search?q=Design&type=tasks&workspaceId=${workspace.id}`,
    );
    const taskResults = (
      (await tasksOnly.json()) as { results: { type: string }[] }
    ).results;
    expect(taskResults).toEqual([expect.objectContaining({ type: "task" })]);
  });

  it("never returns appointments from a workspace the user does not belong to", async () => {
    const { user: owner } = await createWorkspaceMember({ role: "owner" });
    const { workspace: victimWorkspace } = await createWorkspaceMember({
      role: "owner",
    });
    const project = await createProjectFixture({
      workspaceId: victimWorkspace.id,
    });
    await createAppointmentFixture(project.project, "Secret appointment");

    mockAuthenticatedSession(owner);
    const { app } = createApp();

    const response = await app.request("/api/search?q=Secret");

    expect(response.status).toBe(200);
    expect(((await response.json()) as { results: unknown[] }).results).toEqual(
      [],
    );
  });
});
