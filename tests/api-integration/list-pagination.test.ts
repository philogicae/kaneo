import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// Unbounded collection endpoints made MCP text payloads grow with history.
// These cover the optional limit/offset slices added for bounded reads.

let nextTaskNumber = 1;

type Scene = Awaited<ReturnType<typeof seedScene>>;

async function seedScene() {
  const member = await createWorkspaceMember({ role: "owner" });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });

  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      userId: member.user.id,
      title: "Paginated task",
      description: "",
      status: "to-do",
      priority: "medium",
      number: nextTaskNumber++,
      position: 1,
    })
    .returning();

  if (!task) throw new Error("Failed to seed task fixture");
  return { member, project, columns, task };
}

async function seedSecondaryTask(scene: Scene, position: number) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: scene.project.id,
      columnId: scene.columns.todo.id,
      userId: scene.member.user.id,
      title: `Secondary ${position}`,
      description: "",
      status: "to-do",
      priority: "medium",
      number: nextTaskNumber++,
      position,
    })
    .returning();

  if (!task) throw new Error("Failed to seed secondary task");
  return task;
}

async function seedActivities(scene: Scene) {
  for (let i = 0; i < 3; i++) {
    await db.insert(schema.activityTable).values({
      taskId: scene.task.id,
      userId: scene.member.user.id,
      content: `Activity ${i}`,
      type: "status_changed",
      createdAt: new Date(2026, 0, 1, 10, i),
    });
  }
}

async function seedComments(scene: Scene) {
  for (let i = 0; i < 3; i++) {
    await db.insert(schema.activityTable).values({
      taskId: scene.task.id,
      userId: scene.member.user.id,
      content: `Comment ${i}`,
      type: "comment",
      createdAt: new Date(2026, 0, 2, 10, i),
    });
  }
}

async function seedTimeEntries(scene: Scene) {
  for (let i = 0; i < 3; i++) {
    await db.insert(schema.timeEntryTable).values({
      taskId: scene.task.id,
      userId: scene.member.user.id,
      description: `Entry ${i}`,
      startTime: new Date(2026, 0, 3, 9 + i),
      duration: 60,
    });
  }
}

describe("list pagination", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    nextTaskNumber = 1;
  });

  it("slices activity, comments and time entries with limit/offset", async () => {
    const scene = await seedScene();
    await seedActivities(scene);
    await seedComments(scene);
    await seedTimeEntries(scene);

    mockAuthenticatedSession(scene.member.user);
    const { app } = createApp();

    const activity = await (
      await app.request(`/api/activity/${scene.task.id}?limit=2&offset=1`)
    ).json();
    expect(activity).toHaveLength(2);

    const comments = await (
      await app.request(`/api/comment/${scene.task.id}?limit=2`)
    ).json();
    expect(comments).toHaveLength(2);

    const entries = await (
      await app.request(
        `/api/time-entry/task/${scene.task.id}?limit=2&offset=2`,
      )
    ).json();
    expect(entries).toHaveLength(1);

    const all = await (
      await app.request(`/api/time-entry/task/${scene.task.id}`)
    ).json();
    expect(all).toHaveLength(3);
  });

  it("rejects an out-of-range limit before querying", async () => {
    const scene = await seedScene();

    mockAuthenticatedSession(scene.member.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/activity/${scene.task.id}?limit=0`,
    );

    expect(response.status).toBe(400);
  });

  it("embeds only the requested task slice in get_project", async () => {
    const scene = await seedScene();
    await seedSecondaryTask(scene, 2);
    await seedSecondaryTask(scene, 3);

    mockAuthenticatedSession(scene.member.user);
    const { app } = createApp();

    const sliced = await (
      await app.request(
        `/api/project/${scene.project.id}?tasksLimit=2&tasksOffset=1`,
      )
    ).json();
    expect(sliced.tasks).toHaveLength(2);
    expect(
      sliced.tasks.map((task: { position: number }) => task.position),
    ).toEqual([2, 3]);

    const full = await (
      await app.request(`/api/project/${scene.project.id}`)
    ).json();
    expect(full.tasks).toHaveLength(3);
  });

  it("honours the documented 200-task page size on the per-project board", async () => {
    const scene = await seedScene();

    mockAuthenticatedSession(scene.member.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/task/tasks/${scene.project.id}?limit=200`,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    // The controller used to cap every request at 100 while the schema and the
    // MCP tool advertised 200, so an agent asking for 200 silently lost tasks.
    expect(body.pagination.pageSize).toBe(200);
    expect(body.pagination.total).toBe(1);
    expect(
      body.data.columns.flatMap((column: { tasks: unknown[] }) => column.tasks),
    ).toHaveLength(1);
  });
});
