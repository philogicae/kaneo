import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
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

describe("project charts and backlog statistics", () => {
  it("returns weekly buckets and counts planned tasks in statistics", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Aurora",
      slug: "AUR",
    });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const now = Date.now();
    const week = (weeksAgo: number) =>
      new Date(now - weeksAgo * 7 * 24 * 60 * 60 * 1000);

    const [createdThisWeek] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Fresh task",
        status: "to-do",
        columnId: columns.todo.id,
        priority: "medium",
        number: 1,
        position: 1,
        createdAt: week(0),
        updatedAt: week(0),
      })
      .returning();

    await db.insert(schema.taskTable).values({
      projectId: project.id,
      title: "Backlog task",
      status: "planned",
      columnId: null,
      priority: "low",
      number: 2,
      position: 1,
      createdAt: week(2),
      updatedAt: week(2),
    });

    const [completedTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Done task",
        status: "done",
        columnId: columns.done.id,
        priority: "high",
        number: 3,
        position: 1,
        createdAt: week(4),
        updatedAt: week(1),
      })
      .returning();

    // The completion signal lives in the activity feed, not on the task.
    await db.insert(schema.activityTable).values({
      taskId: completedTask.id,
      type: "status_changed",
      eventData: { oldStatus: "to-do", newStatus: "done" },
      userId: user.id,
      createdAt: week(1),
      updatedAt: week(1),
    });

    const charts = await app.request(`/api/project/${project.id}/charts`);
    expect(charts.status).toBe(200);
    const buckets = (await charts.json()) as Array<{
      weekStart: string;
      created: number;
      completed: number;
    }>;
    expect(buckets.length).toBeGreaterThan(20);

    const totalCreated = buckets.reduce((sum, b) => sum + b.created, 0);
    const totalCompleted = buckets.reduce((sum, b) => sum + b.completed, 0);
    expect(totalCreated).toBe(3);
    expect(totalCompleted).toBe(1);
    // Exactly one completion lands somewhere in the covered range.
    expect(Math.max(...buckets.map((b) => b.completed))).toBe(1);
    expect(createdThisWeek).toBeDefined();

    const list = await app.request(`/api/project?workspaceId=${workspace.id}`);
    expect(list.status).toBe(200);
    const [projectItem] = (await list.json()) as Array<{
      statistics: { plannedTasks: number; totalTasks: number };
    }>;
    expect(projectItem.statistics.plannedTasks).toBe(1);
    expect(projectItem.statistics.totalTasks).toBe(3);
  });
});
