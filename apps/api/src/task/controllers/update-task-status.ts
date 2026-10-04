import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { columnTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { shiftRecurrenceDate } from "../recurrence";
import { assertValidTaskStatus } from "../validate-task-fields";
import createTask from "./create-task";
import { publishTaskMutation } from "./task-mutation-effects";
import { withLockedTask } from "./with-locked-task";

async function updateTaskStatus({
  id,
  status,
  currentUserId,
}: {
  id: string;
  status: string;
  currentUserId: string;
}) {
  // Captured for the recurrence spawn below, which runs outside the write.
  let column: { isFinal: boolean | null } | undefined;

  const { before: existingTask, after: updatedTask } = await withLockedTask(
    id,
    async (tx, existingTask) => {
      await assertValidTaskStatus(status, existingTask.projectId, tx);

      const destination = await tx.query.columnTable.findFirst({
        where: and(
          eq(columnTable.projectId, existingTask.projectId),
          eq(columnTable.slug, status),
        ),
      });
      column = destination;

      const [updatedTask] = await tx
        .update(taskTable)
        .set({ status, columnId: destination?.id ?? null })
        .where(eq(taskTable.id, id))
        .returning();

      if (!updatedTask) {
        throw new HTTPException(500, {
          message: "Failed to update task status",
        });
      }

      return updatedTask;
    },
  );

  await publishTaskMutation(existingTask, updatedTask, currentUserId, {
    fields: ["status"],
  });

  // A legacy row whose status already matches but whose column is missing is a
  // repair, not a transition: the client refreshes, the activity log does not
  // grow a status change nobody made.
  if (
    existingTask.status === updatedTask.status &&
    existingTask.columnId !== updatedTask.columnId
  ) {
    await publishEvent("task.updated", {
      taskId: updatedTask.id,
      projectId: updatedTask.projectId,
      userId: currentUserId,
    });
    await publishEvent("task-relation.refresh", {
      projectId: updatedTask.projectId,
      userId: currentUserId,
    });
  }

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
