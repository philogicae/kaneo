import { and, asc, eq, inArray, notLike } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  assetTable,
  columnTable,
  labelTable,
  projectTable,
  taskReminderSentTable,
  taskTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { queueStorageCleanup } from "../../storage/cleanup-queue";
import { removeLabelFromGitea } from "../../plugins/gitea/utils/sync-label-to-gitea";
import { removeLabelFromGitHub } from "../../plugins/github/utils/sync-label-to-github";
import { removeLabelFromGitlab } from "../../plugins/gitlab/utils/sync-label-to-gitlab";
import { assertAssignableUser } from "../../utils/assert-assignable-user";
import {
  assertValidPriority,
  assertValidTaskStatus,
} from "../validate-task-fields";
import { getSubtaskParentProjects } from "../get-subtask-parent-projects";
import { publishTaskMutation } from "./task-mutation-effects";

type BulkOperation =
  | "updateStatus"
  | "updatePriority"
  | "updateAssignee"
  | "delete"
  | "addLabel"
  | "removeLabel"
  | "updateDueDate";

async function bulkUpdateTasks({
  taskIds,
  operation,
  value,
  userId,
}: {
  taskIds: string[];
  operation: BulkOperation;
  value?: string | null;
  userId: string;
}) {
  const tasks = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      projectId: taskTable.projectId,
      userId: taskTable.userId,
      dueDate: taskTable.dueDate,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(inArray(taskTable.id, taskIds));

  if (tasks.length === 0) {
    throw new HTTPException(404, {
      message: "No tasks found",
    });
  }

  const workspaceIds = [...new Set(tasks.map((t) => t.workspaceId))];

  if (workspaceIds.length > 1) {
    throw new HTTPException(400, {
      message: "All tasks must belong to the same workspace",
    });
  }

  const workspaceId = workspaceIds[0];

  if (!workspaceId) {
    throw new HTTPException(400, {
      message: "Could not determine workspace",
    });
  }

  const [membership] = await db
    .select({ id: workspaceUserTable.id })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.userId, userId),
        eq(workspaceUserTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new HTTPException(403, {
      message: "You don't have access to this workspace",
    });
  }

  const foundIds = tasks.map((t) => t.id);
  let updatedCount = 0;

  switch (operation) {
    case "updateStatus": {
      if (!value) {
        throw new HTTPException(400, { message: "Status value is required" });
      }
      const projectIds = [...new Set(tasks.map((t) => t.projectId))];

      // Every destination is validated before the first write, so a bad slug in
      // the last project cannot leave the first half of the batch applied.
      const destinations = new Map<string, string | null>();
      for (const projectId of projectIds) {
        await assertValidTaskStatus(value, projectId);
        const column = await db.query.columnTable.findFirst({
          where: and(
            eq(columnTable.projectId, projectId),
            eq(columnTable.slug, value),
          ),
        });
        destinations.set(projectId, column?.id ?? null);
      }

      const { updatedTasks, beforeById } = await db.transaction(async (tx) => {
        const locked = await tx
          .select({
            id: taskTable.id,
            projectId: taskTable.projectId,
            status: taskTable.status,
          })
          .from(taskTable)
          .where(inArray(taskTable.id, foundIds))
          .orderBy(asc(taskTable.id));
        const originalProjects = new Map(
          tasks.map((task) => [task.id, task.projectId]),
        );
        if (
          locked.length !== foundIds.length ||
          locked.some(
            (task) =>
              task.projectId !== originalProjects.get(task.id) ||
              task.status === value,
          )
        )
          throw new HTTPException(409, {
            message: "Tasks changed; retry the operation",
          });
        const before = new Map(locked.map((task) => [task.id, task]));
        const changed: (typeof taskTable.$inferSelect)[] = [];
        for (const projectId of projectIds) {
          const projectTaskIds = tasks
            .filter((task) => task.projectId === projectId)
            .map((task) => task.id);
          const rows = await tx
            .update(taskTable)
            .set({
              status: value,
              columnId: destinations.get(projectId) ?? null,
            })
            .where(inArray(taskTable.id, projectTaskIds))
            .returning();
          if (rows.length !== projectTaskIds.length)
            throw new HTTPException(409, {
              message: "Tasks changed projects; retry the operation",
            });
          changed.push(...rows);
        }
        return { updatedTasks: changed, beforeById: before };
      });
      updatedCount = updatedTasks.length;

      // One parent lookup for the batch: the boards are the same for every
      // task, so each per-task event opts out of its own refresh.
      await publishEvent("subtask-parents.refresh", {
        projects: await getSubtaskParentProjects(foundIds),
      });
      for (const updatedTask of updatedTasks) {
        await publishTaskMutation(
          beforeById.get(updatedTask.id)!,
          updatedTask,
          userId,
          {
            fields: ["status"],
            skipRelationRefresh: true,
            skipSubtaskParentRefresh: true,
          },
        );
      }
      for (const projectId of projectIds)
        await publishEvent("task-relation.refresh", { projectId, userId });
      break;
    }

    case "updatePriority": {
      if (!value) {
        throw new HTTPException(400, { message: "Priority value is required" });
      }
      assertValidPriority(value);

      // Read the overwritten priority inside the write transaction, so the
      // event reports what was really displaced rather than a stale read.
      const before = await db.transaction(async (tx) => {
        const locked = await tx
          .select({
            id: taskTable.id,
            projectId: taskTable.projectId,
            title: taskTable.title,
            userId: taskTable.userId,
            priority: taskTable.priority,
          })
          .from(taskTable)
          .where(inArray(taskTable.id, foundIds))
          .orderBy(asc(taskTable.id));
        const originalProjects = new Map(
          tasks.map((task) => [task.id, task.projectId]),
        );
        if (
          locked.length !== foundIds.length ||
          locked.some(
            (task) => task.projectId !== originalProjects.get(task.id),
          )
        )
          throw new HTTPException(409, {
            message: "Tasks changed projects; retry the operation",
          });
        await tx
          .update(taskTable)
          .set({ priority: value })
          .where(inArray(taskTable.id, foundIds));
        return locked;
      });
      updatedCount = before.length;

      for (const task of before)
        await publishTaskMutation(task, { ...task, priority: value }, userId, {
          fields: ["priority"],
        });
      break;
    }

    case "updateAssignee": {
      const assigneeId = value?.trim() || null;

      if (assigneeId) {
        // A bulk assignee change may span projects: the target must be able
        // to open every project receiving the assignment.
        for (const projectId of new Set(tasks.map((task) => task.projectId))) {
          await assertAssignableUser(assigneeId, projectId);
        }
      }

      // Resolved once for the whole batch, not once per task.
      const assignee = assigneeId
        ? await db.query.userTable.findFirst({
            columns: { name: true },
            where: eq(userTable.id, assigneeId),
          })
        : undefined;

      const before = await db.transaction(async (tx) => {
        const locked = await tx
          .select({
            id: taskTable.id,
            projectId: taskTable.projectId,
            title: taskTable.title,
            userId: taskTable.userId,
          })
          .from(taskTable)
          .where(inArray(taskTable.id, foundIds))
          .orderBy(asc(taskTable.id));
        const originalProjects = new Map(
          tasks.map((task) => [task.id, task.projectId]),
        );
        if (
          locked.length !== foundIds.length ||
          locked.some(
            (task) => task.projectId !== originalProjects.get(task.id),
          )
        )
          throw new HTTPException(409, {
            message: "Tasks changed projects; retry the operation",
          });
        await tx
          .update(taskTable)
          .set({ userId: assigneeId })
          .where(inArray(taskTable.id, foundIds));
        return locked;
      });
      updatedCount = before.length;

      for (const task of before)
        await publishTaskMutation(
          task,
          { ...task, userId: assigneeId },
          userId,
          { fields: ["userId"], assigneeName: assignee?.name ?? null },
        );
      break;
    }

    case "delete": {
      // Resolved before the delete: the relation rows that name the parent
      // boards are cascade-deleted with the tasks.
      const parentProjects = await getSubtaskParentProjects(foundIds);
      // Collecting keys and deleting in one transaction keeps an asset that
      // moved with its task out of the cleanup queue, and refuses the whole
      // batch when a task changed projects since the authorized read.
      const result = await db.transaction(async (tx) => {
        const locked = await tx
          .select({ id: taskTable.id, projectId: taskTable.projectId })
          .from(taskTable)
          .where(inArray(taskTable.id, foundIds))
          .orderBy(asc(taskTable.id));
        const originalProjects = new Map(
          tasks.map((task) => [task.id, task.projectId]),
        );
        if (
          locked.length !== foundIds.length ||
          locked.some(
            (task) => task.projectId !== originalProjects.get(task.id),
          )
        )
          throw new HTTPException(409, {
            message: "Tasks changed projects; retry the operation",
          });
        const assets = await tx
          .select({ objectKey: assetTable.objectKey })
          .from(assetTable)
          .where(inArray(assetTable.taskId, foundIds));
        await queueStorageCleanup(
          tx,
          assets.map((asset) => asset.objectKey),
        );
        return tx.delete(taskTable).where(inArray(taskTable.id, foundIds));
      });

      updatedCount = result.rowsAffected ?? foundIds.length;

      await publishEvent("subtask-parents.refresh", {
        projects: parentProjects,
      });

      for (const task of tasks) {
        await publishEvent("task.deleted", {
          taskId: task.id,
          projectId: task.projectId,
          userId,
          title: task.title,
        });
      }
      break;
    }

    case "addLabel": {
      if (!value) {
        throw new HTTPException(400, { message: "Label ID is required" });
      }

      const label = await db.query.labelTable.findFirst({
        where: eq(labelTable.id, value),
      });

      if (!label) {
        throw new HTTPException(404, { message: "Label not found" });
      }

      if (label.workspaceId && label.workspaceId !== workspaceId) {
        throw new HTTPException(400, {
          message: "Label and tasks must belong to the same workspace",
        });
      }

      for (const task of tasks) {
        const existingAssignment = await db.query.labelTable.findFirst({
          where: and(
            eq(labelTable.name, label.name),
            eq(labelTable.taskId, task.id),
          ),
        });

        if (!existingAssignment) {
          await db
            .insert(labelTable)
            .values({
              name: label.name,
              color: label.color,
              workspaceId: workspaceId,
              taskId: task.id,
            })
            .onConflictDoNothing({
              target: [labelTable.taskId, labelTable.name],
            });
          updatedCount++;

          await publishEvent("task.label_assigned", {
            projectId: task.projectId,
            taskId: task.id,
            userId,
            type: "label_assigned",
          });
        }
      }
      break;
    }

    case "removeLabel": {
      if (!value) {
        throw new HTTPException(400, { message: "Label ID is required" });
      }

      const label = await db.query.labelTable.findFirst({
        where: eq(labelTable.id, value),
      });

      if (!label) {
        throw new HTTPException(404, { message: "Label not found" });
      }

      const deletedLabels = await db
        .delete(labelTable)
        .where(
          and(
            eq(labelTable.workspaceId, workspaceId),
            eq(labelTable.name, label.name),
            inArray(labelTable.taskId, foundIds),
          ),
        )
        .returning();

      updatedCount = deletedLabels.length;

      for (const deletedLabel of deletedLabels) {
        if (!deletedLabel.taskId) continue;

        removeLabelFromGitHub(deletedLabel.taskId, deletedLabel.name).catch(
          (error) => {
            console.error("Failed to remove label from GitHub:", error);
          },
        );
        removeLabelFromGitea(deletedLabel.taskId, deletedLabel.name).catch(
          (error) => {
            console.error("Failed to remove label from Gitea:", error);
          },
        );
        removeLabelFromGitlab(deletedLabel.taskId, deletedLabel.name).catch(
          (error) => {
            console.error("Failed to remove label from GitLab:", error);
          },
        );

        const task = tasks.find((t) => t.id === deletedLabel.taskId);
        if (!task) continue;

        await publishEvent("task.label_unassigned", {
          label: deletedLabel,
          task,
          projectId: task.projectId,
          taskId: deletedLabel.taskId,
          userId,
          type: "label_unassigned",
        });
      }
      break;
    }

    case "updateDueDate": {
      let parsedDate: Date | null = null;
      if (value) {
        parsedDate = new Date(value);
        if (Number.isNaN(parsedDate.getTime())) {
          throw new HTTPException(400, {
            message: `Invalid date value "${value}"`,
          });
        }
      }

      // The comparison runs against the dates read inside the write
      // transaction, so a concurrent date change is neither silently discarded
      // nor reported as an unchanged update.
      const { updatedTasks, beforeById } = await db.transaction(async (tx) => {
        const locked = await tx
          .select({
            id: taskTable.id,
            projectId: taskTable.projectId,
            title: taskTable.title,
            dueDate: taskTable.dueDate,
          })
          .from(taskTable)
          .where(inArray(taskTable.id, foundIds))
          .orderBy(asc(taskTable.id));
        const originalProjects = new Map(
          tasks.map((task) => [task.id, task.projectId]),
        );
        if (
          locked.length !== foundIds.length ||
          locked.some(
            (task) => task.projectId !== originalProjects.get(task.id),
          )
        )
          throw new HTTPException(409, {
            message: "Tasks changed projects; retry the operation",
          });
        const before = new Map(locked.map((task) => [task.id, task]));
        // Same contract as the single-task due-date endpoint: due-date driven
        // reminder history must reset so the new date notifies, while
        // start-anchored Telegram reminders stay untouched.
        const changedIds = locked
          .filter(
            (task) =>
              (task.dueDate?.getTime() ?? null) !==
              (parsedDate?.getTime() ?? null),
          )
          .map((task) => task.id);
        if (changedIds.length > 0)
          await tx
            .delete(taskReminderSentTable)
            .where(
              and(
                inArray(taskReminderSentTable.taskId, changedIds),
                notLike(
                  taskReminderSentTable.reminderType,
                  "telegram_unified:%",
                ),
              ),
            );
        const rows = await tx
          .update(taskTable)
          .set({ dueDate: parsedDate })
          .where(inArray(taskTable.id, foundIds))
          .returning();
        return { updatedTasks: rows, beforeById: before };
      });
      updatedCount = updatedTasks.length;

      for (const updatedTask of updatedTasks)
        await publishTaskMutation(
          beforeById.get(updatedTask.id)!,
          updatedTask,
          userId,
          { fields: ["dueDate"] },
        );
      break;
    }

    default: {
      throw new HTTPException(400, {
        message: `Unknown operation "${operation}"`,
      });
    }
  }

  return { success: true, updatedCount };
}

export default bulkUpdateTasks;
