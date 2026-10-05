import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { milestoneTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function updateTaskMilestone({
  id,
  milestoneId,
  currentUserId,
}: {
  id: string;
  milestoneId: string | null;
  currentUserId: string;
}) {
  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!existingTask) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  if (milestoneId) {
    const milestone = await db.query.milestoneTable.findFirst({
      where: eq(milestoneTable.id, milestoneId),
    });
    if (!milestone) {
      throw new HTTPException(400, { message: "Milestone not found" });
    }
    if (milestone.projectId !== existingTask.projectId) {
      throw new HTTPException(400, {
        message: "Milestone and task must belong to the same project",
      });
    }
  }

  if (existingTask.milestoneId === milestoneId) {
    return existingTask;
  }

  const [updatedTask] = await db
    .update(taskTable)
    .set({ milestoneId })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task milestone",
    });
  }

  await publishEvent("task.milestone_changed", {
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    userId: currentUserId,
    oldMilestoneId: existingTask.milestoneId,
    newMilestoneId: milestoneId,
    title: updatedTask.title,
    type: "milestone_changed",
  });

  return updatedTask;
}

export default updateTaskMilestone;
