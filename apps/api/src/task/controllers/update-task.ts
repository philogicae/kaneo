import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  columnTable,
  taskReminderSentTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { deleteOrphanedAssets } from "../../storage/cleanup-assets";
import {
  assertAssignableUser,
  getProjectWorkspaceId,
} from "../../utils/assert-assignable-user";
import type { RecurrenceRule } from "../recurrence";
import { assertValidTaskStatus } from "../validate-task-fields";

async function updateTask(
  id: string,
  title: string,
  status: string,
  startDate: Date | undefined,
  dueDate: Date | undefined,
  projectId: string,
  description: string,
  priority: string,
  position: number,
  userId?: string,
  currentUserId?: string,
  reminderOffsets?: number[] | null,
  recurrence?: RecurrenceRule | null,
) {
  const [existingTask] = await db
    .select({
      id: taskTable.id,
      description: taskTable.description,
      status: taskTable.status,
      projectId: taskTable.projectId,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
      reminderOffsets: taskTable.reminderOffsets,
    })
    .from(taskTable)
    .where(eq(taskTable.id, id))
    .limit(1);

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  if (projectId !== existingTask.projectId) {
    throw new HTTPException(400, {
      message: "Use the task move endpoint to move tasks between projects",
    });
  }

  await assertValidTaskStatus(status, projectId);

  const normalizedUserId = userId?.trim() || undefined;

  if (normalizedUserId) {
    await assertAssignableUser(
      normalizedUserId,
      await getProjectWorkspaceId(projectId),
    );
  }

  const column = await db.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, projectId),
      eq(columnTable.slug, status),
    ),
  });

  const [updatedTask] = await db
    .update(taskTable)
    .set({
      title,
      status,
      columnId: column?.id ?? null,
      startDate: startDate || null,
      dueDate: dueDate || null,
      projectId,
      description,
      priority,
      position,
      userId: normalizedUserId ?? null,
      ...(reminderOffsets !== undefined
        ? { reminderOffsets: reminderOffsets ?? null }
        : {}),
      ...(recurrence !== undefined ? { recurrence: recurrence ?? null } : {}),
    })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task",
    });
  }

  if (reminderOffsets !== undefined) {
    const offsetsChanged =
      JSON.stringify(reminderOffsets ?? null) !==
      JSON.stringify(existingTask.reminderOffsets ?? null);
    // Reminder history is keyed to the date the offsets count down from, so
    // moving the start date invalidates what has already been sent.
    const datesChanged =
      (startDate?.getTime() ?? null) !==
        (existingTask.startDate
          ? new Date(existingTask.startDate).getTime()
          : null) ||
      (dueDate?.getTime() ?? null) !==
        (existingTask.dueDate
          ? new Date(existingTask.dueDate).getTime()
          : null);
    if (offsetsChanged || datesChanged) {
      await db
        .delete(taskReminderSentTable)
        .where(eq(taskReminderSentTable.taskId, id));
    }
  }

  if (existingTask.status !== status) {
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
  }

  await publishEvent("task.updated", {
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    title: updatedTask.title,
    status: updatedTask.status,
    userId: currentUserId,
  });

  if (existingTask.description !== description) {
    deleteOrphanedAssets(existingTask.description, description, {
      taskId: id,
    }).catch(() => {});
  }

  return updatedTask;
}

export default updateTask;
