import { and, eq, like, notLike } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskReminderSentTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function updateTaskDueDate({
  id,
  dueDate,
  reminderOffsets,
  currentUserId,
}: {
  id: string;
  dueDate: Date | null;
  reminderOffsets?: number[] | null;
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

  // Per-task Telegram reminders count down from the start date, so a due-date
  // change must not reset them (that could double-send inside the same window).
  // Due-date driven reminders (in-app, generic webhook) are reset so the new
  // date triggers fresh notifications.
  const dueDateChanged =
    (dueDate?.getTime() ?? null) !== (existingTask.dueDate?.getTime() ?? null);
  const offsetsChanged =
    reminderOffsets !== undefined &&
    JSON.stringify(reminderOffsets ?? null) !==
      JSON.stringify(existingTask.reminderOffsets ?? null);

  if (dueDateChanged) {
    await db
      .delete(taskReminderSentTable)
      .where(
        and(
          eq(taskReminderSentTable.taskId, id),
          notLike(taskReminderSentTable.reminderType, "telegram_unified:%"),
        ),
      );
  }
  if (offsetsChanged) {
    await db
      .delete(taskReminderSentTable)
      .where(
        and(
          eq(taskReminderSentTable.taskId, id),
          like(taskReminderSentTable.reminderType, "telegram_unified:%"),
        ),
      );
  }

  const [updatedTask] = await db
    .update(taskTable)
    .set({
      dueDate: dueDate || null,
      ...(reminderOffsets !== undefined
        ? { reminderOffsets: reminderOffsets ?? null }
        : {}),
    })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task due date",
    });
  }

  if (dueDateChanged) {
    await publishEvent("task.due_date_changed", {
      taskId: updatedTask.id,
      projectId: updatedTask.projectId,
      userId: currentUserId,
      oldDueDate: existingTask.dueDate,
      newDueDate: dueDate,
      title: updatedTask.title,
      type: "due_date_changed",
    });
  }

  return updatedTask;
}

export default updateTaskDueDate;
