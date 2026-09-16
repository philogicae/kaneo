import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { subscribeToEvent } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type CapturedEvent = { type: string; data: Record<string, unknown> };
const captured: CapturedEvent[] = [];

for (const type of [
  "appointment.created",
  "appointment.updated",
  "appointment.deleted",
  "task.deleted",
]) {
  subscribeToEvent<Record<string, unknown>>(type, async (data) => {
    captured.push({ type, data });
  });
}

function eventsOf(type: string) {
  return captured.filter((event) => event.type === type).map((e) => e.data);
}

describe("appointment realtime events", () => {
  let app: ReturnType<typeof createApp>["app"];
  let user: Awaited<ReturnType<typeof createWorkspaceMember>>["user"];
  let projectId: string;

  beforeEach(async () => {
    await resetTestDatabase();
    captured.length = 0;
    const { user: member, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    user = member;
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Orbit",
      slug: "ORB",
    });
    projectId = project.id;
    mockAuthenticatedSession(user);
    ({ app } = createApp());
  });

  it("publishes appointment.created with actor and assignee", async () => {
    const created = await app.request("/api/appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        title: "Design review",
        startDate: "2026-09-20T09:00:00.000Z",
        dueDate: "2026-09-20T10:00:00.000Z",
        priority: "high",
        userId: user.id,
      }),
    });
    expect(created.status).toBe(200);
    const appointment = (await created.json()) as { id: string };

    expect(eventsOf("appointment.created")).toEqual([
      expect.objectContaining({
        appointmentId: appointment.id,
        projectId,
        userId: user.id,
        currentUserId: user.id,
        initiatorId: user.id,
        title: "Design review",
        priority: "high",
      }),
    ]);
  });

  it("publishes appointment.updated with the previous and new schedule", async () => {
    const created = await app.request("/api/appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        title: "Kickoff",
        startDate: "2026-09-20T09:00:00.000Z",
      }),
    });
    const appointment = (await created.json()) as { id: string };
    captured.length = 0;

    const updated = await app.request(`/api/appointment/${appointment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Kickoff (moved)",
        startDate: "2026-09-21T11:00:00.000Z",
        priority: "urgent",
      }),
    });
    expect(updated.status).toBe(200);

    expect(eventsOf("appointment.updated")).toEqual([
      expect.objectContaining({
        appointmentId: appointment.id,
        projectId,
        currentUserId: user.id,
        title: "Kickoff (moved)",
        oldStartDate: new Date("2026-09-20T09:00:00.000Z"),
        newStartDate: new Date("2026-09-21T11:00:00.000Z"),
        oldPriority: "medium",
        newPriority: "urgent",
      }),
    ]);
  });

  it("publishes appointment.deleted on removal", async () => {
    const created = await app.request("/api/appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, title: "Standup" }),
    });
    const appointment = (await created.json()) as { id: string };
    captured.length = 0;

    const removed = await app.request(`/api/appointment/${appointment.id}`, {
      method: "DELETE",
    });
    expect(removed.status).toBe(200);

    expect(eventsOf("appointment.deleted")).toEqual([
      expect.objectContaining({
        appointmentId: appointment.id,
        projectId,
        currentUserId: user.id,
        title: "Standup",
      }),
    ]);
  });

  it("publishes task.deleted and appointment.created on a backlog conversion", async () => {
    const [plannedTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId,
        title: "Kickoff call",
        status: "planned",
        columnId: null,
        priority: "high",
        number: 1,
        position: 1,
        startDate: new Date("2026-09-20T08:00:00.000Z"),
      })
      .returning();

    const moved = await app.request("/api/appointment/from-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: plannedTask.id }),
    });
    expect(moved.status).toBe(200);
    const appointment = (await moved.json()) as { id: string };

    expect(eventsOf("appointment.created")).toEqual([
      expect.objectContaining({
        appointmentId: appointment.id,
        projectId,
        movedFromTaskId: plannedTask.id,
        currentUserId: user.id,
      }),
    ]);
    expect(eventsOf("task.deleted")).toEqual([
      expect.objectContaining({
        taskId: plannedTask.id,
        projectId,
        userId: user.id,
        title: "Kickoff call",
      }),
    ]);
  });
});
