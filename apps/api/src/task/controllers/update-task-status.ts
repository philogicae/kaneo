import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { shiftRecurrenceDate } from "../recurrence";
import { assertValidTaskStatus } from "../validate-task-fields";
import createTask from "./create-task";

async function updateTaskStatus({
  id,
  status,
  currentUserId,
}: {
  id: string;
  status: string;
  currentUserId: string;
}) {
  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  await assertValidTaskStatus(status, existingTask.projectId);

  const column = await db.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, existingTask.projectId),
      eq(columnTable.slug, status),
    ),
  });

  const [updatedTask] = await db
    .update(taskTable)
    .set({ status, columnId: column?.id ?? null })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task status",
    });
  }

  await publishEvent("task.status_changed", {
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    userId: currentUserId,
    oldStatus: existingTask.status,
    newStatus: status,
    title: updatedTask.title,
    assigneeId: updatedTask.userId,
    type: "status_changed",
  });

  await publishEvent("task-relation.refresh", {
    projectId: updatedTask.projectId,
    userId: currentUserId,
  });

  // A recurring task completed for the first time spawns its next occurrence
  // in the column it came from, with dates and reminder offsets shifted by
  // one period. Recurrence is anchored to the start date; without one the
  // rule is a leftover from older builds and must not spawn dateless clones.
  const recurrence = existingTask.recurrence;
  const statusChanged = existingTask.status !== status;
  if (
    recurrence &&
    existingTask.startDate &&
    column?.isFinal &&
    statusChanged
  ) {
    await createTask({
      projectId: existingTask.projectId,
      currentUserId,
      userId: existingTask.userId ?? undefined,
      title: existingTask.title,
      description: existingTask.description ?? undefined,
      startDate:
        shiftRecurrenceDate(
          existingTask.startDate ? new Date(existingTask.startDate) : null,
          recurrence,
        ) ?? undefined,
      dueDate:
        shiftRecurrenceDate(
          existingTask.dueDate ? new Date(existingTask.dueDate) : null,
          recurrence,
        ) ?? undefined,
      priority: existingTask.priority,
      status: existingTask.status,
      reminderOffsets: existingTask.reminderOffsets ?? null,
      recurrence,
    });
  }

  return updatedTask;
}

export default updateTaskStatus;
