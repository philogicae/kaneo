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

beforeEach(async () => {
  await resetTestDatabase();
});

describe("appointments", () => {
  it("creates, lists, updates and deletes appointments", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Orbit",
      slug: "ORB",
    });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const created = await app.request("/api/appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        title: "Design review",
        description: "Walk through the weekly grid",
        startDate: "2026-09-15T09:00:00.000Z",
        dueDate: "2026-09-15T10:00:00.000Z",
      }),
    });
    expect(created.status).toBe(200);
    const appointment = (await created.json()) as {
      id: string;
      number: number;
      priority: string;
      title: string;
      assigneeName: string | null;
    };
    expect(appointment.title).toBe("Design review");
    // Appointments default to a real priority, not the task default.
    expect(appointment.priority).toBe("medium");
    expect(appointment.number).toBe(1);

    const list = await app.request(`/api/appointment?projectId=${project.id}`);
    expect(list.status).toBe(200);
    const appointments = (await list.json()) as Array<{ id: string }>;
    expect(appointments.map((row) => row.id)).toEqual([appointment.id]);

    const updated = await app.request(`/api/appointment/${appointment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Design review (final)",
        priority: "high",
        userId: user.id,
      }),
    });
    expect(updated.status).toBe(200);
    const updatedAppointment = (await updated.json()) as {
      title: string;
      priority: string;
      assigneeName: string | null;
    };
    expect(updatedAppointment.title).toBe("Design review (final)");
    expect(updatedAppointment.priority).toBe("high");
    expect(updatedAppointment.assigneeName).toBe(user.name);

    const invalidRange = await app.request(
      `/api/appointment/${appointment.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Broken range",
          startDate: "2026-09-16T10:00:00.000Z",
          dueDate: "2026-09-15T10:00:00.000Z",
        }),
      },
    );
    expect(invalidRange.status).toBe(400);

    const removed = await app.request(`/api/appointment/${appointment.id}`, {
      method: "DELETE",
    });
    expect(removed.status).toBe(200);

    const afterDelete = await app.request(
      `/api/appointment?projectId=${project.id}`,
    );
    expect((await afterDelete.json()) as unknown[]).toEqual([]);
  });

  it("moves a backlog task to appointments and keeps the collections separated", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Comet",
      slug: "COM",
    });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const [plannedTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Kickoff call",
        status: "planned",
        columnId: null,
        priority: "high",
        number: 1,
        position: 1,
        startDate: new Date("2026-09-20T08:00:00.000Z"),
        dueDate: null,
      })
      .returning();

    const [boardTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Board task",
        status: "to-do",
        columnId: columns.todo.id,
        priority: "low",
        number: 2,
        position: 1,
      })
      .returning();

    const moved = await app.request("/api/appointment/from-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: plannedTask.id }),
    });
    expect(moved.status).toBe(200);
    const appointment = (await moved.json()) as {
      id: string;
      title: string;
      priority: string;
      startDate: string | null;
    };
    expect(appointment.title).toBe("Kickoff call");
    expect(appointment.priority).toBe("high");
    expect(appointment.startDate).toBe("2026-09-20T08:00:00.000Z");

    const [taskRow] = await db
      .select({ id: schema.taskTable.id })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, plannedTask.id));
    expect(taskRow).toBeUndefined();

    const board = await app.request(`/api/task/tasks/${project.id}`);
    expect(board.status).toBe(200);
    const boardBody = (await board.json()) as {
      data: {
        columns: Array<{ tasks: Array<{ id: string }> }>;
        plannedTasks: Array<{ id: string }>;
      };
    };
    const boardData = boardBody.data;
    expect(boardData.plannedTasks).toHaveLength(0);
    expect(
      boardData.columns
        .flatMap((column) => column.tasks)
        .map((task) => task.id),
    ).toEqual([boardTask.id]);

    // A board task cannot be converted; the two collections stay separated.
    const rejected = await app.request("/api/appointment/from-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: boardTask.id }),
    });
    expect(rejected.status).toBe(400);

    const list = await app.request(`/api/appointment?projectId=${project.id}`);
    const appointments = (await list.json()) as Array<{ id: string }>;
    expect(appointments.map((row) => row.id)).toEqual([appointment.id]);
  });

  it("rejects creation without task:create permission", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "viewer" });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Pulsar",
      slug: "PUL",
    });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const denied = await app.request("/api/appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, title: "Nope" }),
    });
    expect(denied.status).toBe(403);
  });
});
