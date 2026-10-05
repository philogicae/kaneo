import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { assertAssignableUser } from "../../utils/assert-assignable-user";
import { boardDescription, descriptionDeferred } from "../description-pages";
import type { RecurrenceRule } from "../recurrence";
import { assertValidTaskStatus } from "../validate-task-fields";
import { assertTaskPosition } from "./next-task-position";
import {
  publishTaskMutation,
  recordTaskMutation,
} from "./task-mutation-effects";

async function updateTask(
  id: string,
  title: string,
  status: string,
  startDate: Date | undefined,
  dueDate: Date | undefined,
  projectId: string,
  // Omitted to preserve the stored description: a board list refreshes the
  // summary of a description it never loaded.
  description: string | undefined,
  priority: string,
  position: number,
  userId?: string,
  currentUserId?: string,
  reminderOffsets?: number[] | null,
  recurrence?: RecurrenceRule | null,
) {
  assertTaskPosition(position);

  let [existingTask] = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      priority: taskTable.priority,
      userId: taskTable.userId,
      dueDate: taskTable.dueDate,
      startDate: taskTable.startDate,
      reminderOffsets: taskTable.reminderOffsets,
      // An omitted description must not read as "cleared" below.
      description:
        description === undefined ? sql<null>`null` : taskTable.description,
      status: taskTable.status,
      columnId: taskTable.columnId,
      position: taskTable.position,
      projectId: taskTable.projectId,
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
    await assertAssignableUser(normalizedUserId, projectId);
  }

  const column = await db.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, projectId),
      eq(columnTable.slug, status),
    ),
  });

  const initialPosition = existingTask.position;
  const initialStatus = existingTask.status;

  // Every read that decides what to write happens under the same write slot as
  // the write itself, so a concurrent mutation cannot be misreported as this
  // actor's change.
  const updatedTask = await db.transaction(async (tx) => {
    const [project] = await tx
      .select({ id: projectTable.id })
      .from(projectTable)
      .where(eq(projectTable.id, projectId));
    if (!project) {
      throw new HTTPException(404, { message: "Project not found" });
    }
    const [locked] = await tx
      .select({
        id: taskTable.id,
        title: taskTable.title,
        priority: taskTable.priority,
        userId: taskTable.userId,
        dueDate: taskTable.dueDate,
        startDate: taskTable.startDate,
        reminderOffsets: taskTable.reminderOffsets,
        description:
          description === undefined ? sql<null>`null` : taskTable.description,
        status: taskTable.status,
        columnId: taskTable.columnId,
        position: taskTable.position,
        projectId: taskTable.projectId,
      })
      .from(taskTable)
      .where(and(eq(taskTable.id, id), eq(taskTable.projectId, projectId)));
    if (!locked) {
      throw new HTTPException(409, {
        message: "Task changed projects; retry the update",
      });
    }
    if (
      locked.position !== initialPosition ||
      locked.status !== initialStatus
    ) {
      throw new HTTPException(409, {
        message: "Task order changed; refresh before updating",
      });
    }
    existingTask = locked;

    const [task] = await tx
      .update(taskTable)
      .set({
        title,
        status,
        columnId: column?.id ?? null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        projectId,
        ...(description !== undefined ? { description } : {}),
        priority,
        position,
        userId: normalizedUserId ?? null,
        ...(reminderOffsets !== undefined
          ? { reminderOffsets: reminderOffsets ?? null }
          : {}),
        ...(recurrence !== undefined ? { recurrence: recurrence ?? null } : {}),
      })
      .where(and(eq(taskTable.id, id), eq(taskTable.projectId, projectId)))
      // A board refreshes the summary of a description it never loaded, so the
      // response carries the same deferred shape as the board list.
      .returning({
        ...getTableColumns(taskTable),
        description: boardDescription,
        descriptionDeferred,
      });

    if (task)
      await recordTaskMutation(
        tx,
        existingTask,
        {
          title,
          dueDate: dueDate ?? null,
          startDate: startDate ?? null,
          // Only an explicit payload changes the offsets; an omitted field
          // leaves them untouched and must not read as "cleared".
          ...(reminderOffsets !== undefined ? { reminderOffsets } : {}),
        },
        currentUserId,
      );

    return task;
  });

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task",
    });
  }

  await publishTaskMutation(
    {
      ...existingTask,
      description:
        description === undefined ? undefined : existingTask.description,
    },
    { ...updatedTask, description: description ?? updatedTask.description },
    currentUserId,
  );

  await publishEvent("task.updated", {
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    title: updatedTask.title,
    status: updatedTask.status,
    userId: currentUserId,
  });

  return updatedTask;
}

export default updateTask;
