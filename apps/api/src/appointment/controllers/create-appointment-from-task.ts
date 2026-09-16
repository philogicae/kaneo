import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { appointmentTable, taskTable, userTable } from "../../database/schema";
import { publishEvent } from "../../events";

/**
 * Moves a backlog (planned) task out of the task table and into the
 * appointment collection. The two stay strictly separated: the task row is
 * removed in the same transaction, so it can never be listed or scheduled as
 * a task again.
 */
async function createAppointmentFromTask(
  taskId: string,
  currentUserId?: string,
) {
  const [task] = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      status: taskTable.status,
      userId: taskTable.userId,
      title: taskTable.title,
      description: taskTable.description,
      priority: taskTable.priority,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
    })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  if (task.status !== "planned") {
    throw new HTTPException(400, {
      message: "Only backlog tasks can be moved to appointments",
    });
  }

  const appointment = await db.transaction(async (tx) => {
    const [counters] = await tx
      .select({
        nextNumber: sql<number>`coalesce(max(${appointmentTable.number}), 0) + 1`,
        nextPosition: sql<number>`coalesce(max(${appointmentTable.position}), 0) + 1`,
      })
      .from(appointmentTable)
      .where(eq(appointmentTable.projectId, task.projectId));

    const [created] = await tx
      .insert(appointmentTable)
      .values({
        projectId: task.projectId,
        userId: task.userId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        startDate: task.startDate,
        dueDate: task.dueDate,
        number: counters?.nextNumber ?? 1,
        position: counters?.nextPosition ?? 1,
      })
      .returning();

    await tx.delete(taskTable).where(eq(taskTable.id, task.id));

    return created;
  });

  if (!appointment) {
    throw new HTTPException(500, {
      message: "Failed to move the task to appointments",
    });
  }

  let assigneeName: string | null = null;
  if (appointment.userId) {
    const [assignee] = await db
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, appointment.userId));
    assigneeName = assignee?.name ?? null;
  }

  // The task row is gone, so task caches must drop it; the appointment
  // surfaces in the calendar-like views instead.
  await publishEvent("appointment.created", {
    appointmentId: appointment.id,
    projectId: appointment.projectId,
    userId: appointment.userId ?? "",
    currentUserId,
    title: appointment.title,
    description: appointment.description,
    priority: appointment.priority,
    startDate: appointment.startDate,
    dueDate: appointment.dueDate,
    number: appointment.number,
    movedFromTaskId: task.id,
    type: "created",
  });
  await publishEvent("task.deleted", {
    taskId: task.id,
    projectId: task.projectId,
    userId: currentUserId,
    title: task.title,
  });

  return { ...appointment, assigneeName, assigneeId: appointment.userId };
}

export default createAppointmentFromTask;
