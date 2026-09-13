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

async function seedTaskFor(workspaceId: string) {
  const { project, columns } = await createProjectFixture({ workspaceId });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Tracked task",
      description: "",
      priority: "low",
      status: "to-do",
      columnId: columns.todo?.id ?? null,
      number: 1,
      position: 1,
    })
    .returning();
  return task;
}

// Runs the shipped migration rather than a copy of its SQL, so the test covers
// the artifact that actually reaches an upgraded installation.
beforeEach(async () => {
  await resetTestDatabase();
});

describe("time entry duration", () => {
  it("records elapsed seconds when the entry is created already closed", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const startTime = new Date("2026-01-01T09:00:00.000Z");
    const endTime = new Date("2026-01-01T10:30:00.000Z");

    const response = await app.request("/api/time-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      }),
    });

    expect(response.status).toBe(200);
    const entry = await response.json();
    expect(entry.duration).toBe(5400);
  });

  it("leaves duration unset while the entry is still running", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/time-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        startTime: new Date("2026-01-01T09:00:00.000Z").toISOString(),
      }),
    });

    expect(response.status).toBe(200);
    const entry = await response.json();
    expect(entry.duration).toBeNull();
  });
});

describe("global search", () => {
  it("searches across the user's workspaces when none is given", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    const { workspace: foreignWorkspace } = await createWorkspaceMember({
      role: "owner",
    });
    const foreignTask = await seedTaskFor(foreignWorkspace.id);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/search?q=Tracked");

    expect(response.status).toBe(200);
    const body = await response.json();
    const taskIds = body.results
      .filter((entry: { type: string }) => entry.type === "task")
      .map((entry: { id: string }) => entry.id);
    expect(taskIds).toContain(task.id);
    expect(taskIds).not.toContain(foreignTask.id);
  });
});

describe("time entry validation", () => {
  it("rejects an end time before the start time", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/time-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        startTime: new Date("2026-01-01T10:00:00.000Z").toISOString(),
        endTime: new Date("2026-01-01T09:00:00.000Z").toISOString(),
      }),
    });

    expect(response.status).toBe(400);
  });
});

describe("time entry timestamp validation", () => {
  it("rejects an unparseable start time", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/time-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, startTime: "not-a-date" }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects a calendar-invalid date instead of rolling it forward", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/time-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        startTime: "2026-02-30T10:00:00Z",
      }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects a non-ISO date format", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/time-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, startTime: "01/02/2026" }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects an unparseable end time", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/time-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        startTime: new Date("2026-01-01T09:00:00.000Z").toISOString(),
        endTime: "garbage",
      }),
    });

    expect(response.status).toBe(400);
  });
});

describe("time entry duration limits", () => {
  it("rejects a span that would overflow the duration column", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/time-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        startTime: "1900-01-01T00:00:00.000Z",
        endTime: "2026-01-01T00:00:00.000Z",
      }),
    });

    expect(response.status).toBe(400);
  });
});

describe("time entry deletion", () => {
  it("deletes a logged entry", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const createResponse = await app.request("/api/time-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        startTime: "2026-01-01T09:00:00.000Z",
        endTime: "2026-01-01T10:00:00.000Z",
      }),
    });
    const entry = await createResponse.json();

    const deleteResponse = await app.request(`/api/time-entry/${entry.id}`, {
      method: "DELETE",
    });

    expect(deleteResponse.status).toBe(200);
    const remaining = await db
      .select()
      .from(schema.timeEntryTable)
      .where(eq(schema.timeEntryTable.id, entry.id));
    expect(remaining).toHaveLength(0);

    const secondDelete = await app.request(`/api/time-entry/${entry.id}`, {
      method: "DELETE",
    });
    expect(secondDelete.status).toBe(400);
  });
});
