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
      bucketStart: string;
      created: number;
      completed: number;
    }>;
    // Defaults: the last month bucketed by day.
    expect(buckets.length).toBeGreaterThan(25);
    expect(buckets.length).toBeLessThan(65);
    expect(
      buckets.every((bucket) => bucket.bucketStart.endsWith("T00:00:00.000Z")),
    ).toBe(true);

    const totalCreated = buckets.reduce((sum, b) => sum + b.created, 0);
    const totalCompleted = buckets.reduce((sum, b) => sum + b.completed, 0);
    expect(totalCreated).toBe(3);
    expect(totalCompleted).toBe(1);
    // Exactly one completion lands somewhere in the covered range.
    expect(Math.max(...buckets.map((b) => b.completed))).toBe(1);
    expect(createdThisWeek).toBeDefined();

    // Weekly buckets still narrow with the window.
    const weekly = await app.request(
      `/api/project/${project.id}/charts?range=6m&unit=week`,
    );
    expect(weekly.status).toBe(200);
    const weeklyBuckets = (await weekly.json()) as Array<{
      bucketStart: string;
      created: number;
      completed: number;
    }>;
    expect(weeklyBuckets.length).toBeGreaterThan(20);

    const narrowed = await app.request(
      `/api/project/${project.id}/charts?range=3m&unit=week`,
    );
    expect(narrowed.status).toBe(200);
    const narrowedBuckets = (await narrowed.json()) as Array<{
      bucketStart: string;
      created: number;
      completed: number;
    }>;
    // The window shrinks to roughly a quarter, keeping the recent activity.
    expect(narrowedBuckets.length).toBeLessThan(weeklyBuckets.length);
    expect(narrowedBuckets.length).toBeGreaterThan(9);
    expect(narrowedBuckets.reduce((sum, b) => sum + b.created, 0)).toBe(3);

    // "1w" keeps only the current week's bucket at the weekly unit.
    const weekWindow = await app.request(
      `/api/project/${project.id}/charts?range=1w&unit=week`,
    );
    expect(weekWindow.status).toBe(200);
    const weekBuckets = (await weekWindow.json()) as Array<{
      bucketStart: string;
      created: number;
      completed: number;
    }>;
    expect(weekBuckets).toHaveLength(1);
    expect(weekBuckets[0]?.created).toBe(1);
    expect(weekBuckets[0]?.completed).toBe(0);

    // "all" starts at the project's earliest task and keeps every bucket; it
    // has no daily reading, so the omitted unit falls back to weekly buckets.
    const all = await app.request(
      `/api/project/${project.id}/charts?range=all`,
    );
    expect(all.status).toBe(200);
    const allBuckets = (await all.json()) as Array<{
      bucketStart: string;
      created: number;
      completed: number;
    }>;
    expect(allBuckets.length).toBeGreaterThanOrEqual(5);
    expect(allBuckets.reduce((sum, b) => sum + b.created, 0)).toBe(3);
    expect(allBuckets.reduce((sum, b) => sum + b.completed, 0)).toBe(1);

    // Unit is independent from the window: daily buckets over 3 months.
    const daily = await app.request(
      `/api/project/${project.id}/charts?range=3m&unit=day`,
    );
    expect(daily.status).toBe(200);
    const dailyBuckets = (await daily.json()) as Array<{
      bucketStart: string;
      created: number;
      completed: number;
    }>;
    expect(dailyBuckets.length).toBeGreaterThan(80);
    expect(dailyBuckets.length).toBeLessThan(130);
    expect(dailyBuckets.reduce((sum, b) => sum + b.created, 0)).toBe(3);
    expect(dailyBuckets.reduce((sum, b) => sum + b.completed, 0)).toBe(1);
    // Daily buckets carry the time truncated to midnight UTC.
    expect(
      dailyBuckets.every((b) => b.bucketStart.endsWith("T00:00:00.000Z")),
    ).toBe(true);

    // Hourly buckets over the current week.
    const hourly = await app.request(
      `/api/project/${project.id}/charts?range=1w&unit=hour`,
    );
    expect(hourly.status).toBe(200);
    const hourlyBuckets = (await hourly.json()) as Array<{
      bucketStart: string;
      created: number;
      completed: number;
    }>;
    expect(hourlyBuckets.length).toBeGreaterThan(0);
    expect(hourlyBuckets.length).toBeLessThanOrEqual(168);
    expect(hourlyBuckets.reduce((sum, b) => sum + b.created, 0)).toBe(1);

    // Monthly buckets over a year.
    const monthly = await app.request(
      `/api/project/${project.id}/charts?range=12m&unit=month`,
    );
    expect(monthly.status).toBe(200);
    const monthlyBuckets = (await monthly.json()) as Array<{
      bucketStart: string;
      created: number;
      completed: number;
    }>;
    expect(monthlyBuckets.length).toBeGreaterThanOrEqual(12);
    expect(monthlyBuckets.length).toBeLessThanOrEqual(13);
    expect(monthlyBuckets.reduce((sum, b) => sum + b.created, 0)).toBe(3);
    expect(monthlyBuckets.reduce((sum, b) => sum + b.completed, 0)).toBe(1);

    // Combinations the dashboard does not offer are rejected server-side.
    const tooFine = await app.request(
      `/api/project/${project.id}/charts?range=1w&unit=month`,
    );
    expect(tooFine.status).toBe(400);
    const hourlyQuarter = await app.request(
      `/api/project/${project.id}/charts?range=3m&unit=hour`,
    );
    expect(hourlyQuarter.status).toBe(400);
    const unknownUnit = await app.request(
      `/api/project/${project.id}/charts?unit=minute`,
    );
    expect(unknownUnit.status).toBe(400);

    const invalid = await app.request(
      `/api/project/${project.id}/charts?range=0`,
    );
    expect(invalid.status).toBe(400);

    const list = await app.request(`/api/project?workspaceId=${workspace.id}`);
    expect(list.status).toBe(200);
    const [projectItem] = (await list.json()) as Array<{
      statistics: { plannedTasks: number; totalTasks: number };
    }>;
    expect(projectItem.statistics.plannedTasks).toBe(1);
    expect(projectItem.statistics.totalTasks).toBe(3);
  });
});
