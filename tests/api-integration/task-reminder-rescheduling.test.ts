import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// Reminders count down from the start date, and `task_reminder_sent` dedupes
// them per (task, offset). Moving or clearing a date must therefore reset the
// history, otherwise a stale row silently swallows the reminder for the new
// date. These tests exercise the routes against a real libSQL database.

let nextTaskNumber = 1;

type Scene = Awaited<ReturnType<typeof seedScene>>;

async function seedScene() {
  const member = await createWorkspaceMember({ role: "owner" });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });

  return { member, project, columns };
}

async function seedTask(
  scene: Scene,
  overrides: Partial<typeof schema.taskTable.$inferInsert> = {},
) {
  const number = nextTaskNumber++;

  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: scene.project.id,
      columnId: scene.columns.todo.id,
      userId: scene.member.user.id,
      title: `Task ${number}`,
      description: "",
      status: "to-do",
      priority: "medium",
      number,
      position: number,
      ...overrides,
    })
    .returning();

  if (!task) throw new Error("Failed to seed task fixture");
  return task;
}

async function seedSentReminder(taskId: string, reminderType: string) {
  await db
    .insert(schema.taskReminderSentTable)
    .values({ taskId, reminderType });
}

async function sentReminderTypes(taskId: string) {
  const rows = await db
    .select({ reminderType: schema.taskReminderSentTable.reminderType })
    .from(schema.taskReminderSentTable)
    .where(eq(schema.taskReminderSentTable.taskId, taskId));

  return rows.map((row) => row.reminderType).sort();
}

async function put(url: string, body: unknown) {
  const { app } = createApp();
  return app.request(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fullUpdateBody(
  scene: Scene,
  task: typeof schema.taskTable.$inferSelect,
  overrides: Record<string, unknown> = {},
) {
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority ?? "medium",
    projectId: scene.project.id,
    position: task.position ?? 1,
    ...overrides,
  };
}

describe("task reminder rescheduling", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    nextTaskNumber = 1;
  });

  it("resets reminder history when the start date moves without reminderOffsets", async () => {
    const scene = await seedScene();
    const task = await seedTask(scene, {
      startDate: new Date("2026-09-20T10:00:00.000Z"),
      reminderOffsets: [60],
    });
    await seedSentReminder(task.id, "telegram_unified:60");

    mockAuthenticatedSession(scene.member.user);
    const response = await put(
      `/api/task/${task.id}`,
      fullUpdateBody(scene, task, {
        startDate: "2026-09-21T10:00:00.000Z",
      }),
    );

    expect(response.status).toBe(200);
    await expect(sentReminderTypes(task.id)).resolves.toEqual([]);
  });

  it("resets reminder history when the start date is removed", async () => {
    const scene = await seedScene();
    const task = await seedTask(scene, {
      startDate: new Date("2026-09-20T10:00:00.000Z"),
      reminderOffsets: [60],
    });
    await seedSentReminder(task.id, "telegram_unified:60");

    mockAuthenticatedSession(scene.member.user);
    const response = await put(
      `/api/task/${task.id}`,
      fullUpdateBody(scene, task),
    );

    expect(response.status).toBe(200);
    await expect(sentReminderTypes(task.id)).resolves.toEqual([]);
  });

  it("keeps reminder history when nothing date-related changes", async () => {
    const scene = await seedScene();
    const task = await seedTask(scene, {
      startDate: new Date("2026-09-20T10:00:00.000Z"),
      reminderOffsets: [60],
    });
    await seedSentReminder(task.id, "telegram_unified:60");

    mockAuthenticatedSession(scene.member.user);
    const response = await put(
      `/api/task/${task.id}`,
      fullUpdateBody(scene, task, {
        startDate: "2026-09-20T10:00:00.000Z",
      }),
    );

    expect(response.status).toBe(200);
    await expect(sentReminderTypes(task.id)).resolves.toEqual([
      "telegram_unified:60",
    ]);
  });

  it("resets due-date reminders on a due-date change but keeps start-anchored telegram reminders", async () => {
    const scene = await seedScene();
    const task = await seedTask(scene, {
      startDate: new Date("2026-09-20T10:00:00.000Z"),
      dueDate: new Date("2026-09-25T10:00:00.000Z"),
      reminderOffsets: [60],
    });
    await seedSentReminder(task.id, "telegram_unified:60");
    await seedSentReminder(task.id, "configured_before");
    await seedSentReminder(task.id, "generic_webhook:int-1");

    mockAuthenticatedSession(scene.member.user);
    const response = await put(`/api/task/due-date/${task.id}`, {
      dueDate: "2026-09-26T10:00:00.000Z",
    });

    expect(response.status).toBe(200);
    await expect(sentReminderTypes(task.id)).resolves.toEqual([
      "telegram_unified:60",
    ]);
  });

  it("resets telegram reminder history when offsets change", async () => {
    const scene = await seedScene();
    const task = await seedTask(scene, {
      startDate: new Date("2026-09-20T10:00:00.000Z"),
      dueDate: new Date("2026-09-25T10:00:00.000Z"),
      reminderOffsets: [60],
    });
    await seedSentReminder(task.id, "telegram_unified:60");
    await seedSentReminder(task.id, "configured_before");

    mockAuthenticatedSession(scene.member.user);
    const response = await put(`/api/task/due-date/${task.id}`, {
      dueDate: "2026-09-25T10:00:00.000Z",
      reminderOffsets: [120],
    });

    expect(response.status).toBe(200);
    await expect(sentReminderTypes(task.id)).resolves.toEqual([
      "configured_before",
    ]);
  });

  it("does not record a due-date change when only reminder offsets change", async () => {
    const scene = await seedScene();
    const task = await seedTask(scene, {
      startDate: new Date("2026-09-20T10:00:00.000Z"),
      reminderOffsets: [60],
    });

    mockAuthenticatedSession(scene.member.user);
    const response = await put(`/api/task/due-date/${task.id}`, {
      reminderOffsets: [120],
    });

    expect(response.status).toBe(200);
    const activities = await db
      .select({ type: schema.activityTable.type })
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, task.id));
    expect(activities.map((activity) => activity.type)).not.toContain(
      "due_date_changed",
    );
  });

  it("resets due-date reminder history on a bulk due-date change", async () => {
    const scene = await seedScene();
    const task = await seedTask(scene, {
      startDate: new Date("2026-09-20T10:00:00.000Z"),
      dueDate: new Date("2026-09-25T10:00:00.000Z"),
      reminderOffsets: [60],
    });
    await seedSentReminder(task.id, "telegram_unified:60");
    await seedSentReminder(task.id, "configured_before");

    mockAuthenticatedSession(scene.member.user);
    const { app } = createApp();
    const response = await app.request("/api/task/bulk", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskIds: [task.id],
        operation: "updateDueDate",
        value: "2026-09-26T10:00:00.000Z",
      }),
    });

    expect(response.status).toBe(200);
    await expect(sentReminderTypes(task.id)).resolves.toEqual([
      "telegram_unified:60",
    ]);
  });
});
