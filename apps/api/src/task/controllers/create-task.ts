import { and, eq, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  columnTable,
  customFieldDefinitionTable,
  customFieldValueTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { isJevEnabled } from "../../jev/client";
import {
  suggestTaskQualification,
  type TaskQualification,
} from "../../jev/qualify";
import createLabel from "../../label/controllers/create-label";
import { assertAssignableUser } from "../../utils/assert-assignable-user";
import type { RecurrenceRule } from "../recurrence";
import {
  assertRequiredCustomFields,
  assertValidTaskStatus,
} from "../validate-task-fields";
import { claimTaskNumber } from "./claim-task-numbers";
import { loadQualificationContext } from "./qualify-task";

type CustomFieldInput = {
  fieldId: string;
  value: string;
};

function deduplicateCustomFields(
  customFields?: CustomFieldInput[],
): CustomFieldInput[] | undefined {
  if (!customFields) {
    return undefined;
  }

  const fieldsById = new Map<string, CustomFieldInput>();

  for (const customField of customFields) {
    fieldsById.set(customField.fieldId, customField);
  }

  return Array.from(fieldsById.values());
}

// Suggested labels are attached as task-scoped copies through the regular
// label controller, so events and GitHub/Gitea syncs stay the same. A failed
// label must not fail the creation.
async function attachQualificationLabels(
  qualification: TaskQualification | null,
  taskId: string,
  workspaceId: string | undefined,
  userId: string,
): Promise<Array<{ id: string; name: string; color: string }>> {
  if (!qualification || !workspaceId) {
    return [];
  }

  const labels: Array<{ id: string; name: string; color: string }> = [];
  for (const suggestion of qualification.labels) {
    try {
      const label = await createLabel(
        suggestion.name,
        suggestion.color,
        taskId,
        workspaceId,
        userId,
      );
      labels.push({ id: label.id, name: label.name, color: label.color });
    } catch (error) {
      console.error(
        `Failed to attach suggested label "${suggestion.name}":`,
        error,
      );
    }
  }
  return labels;
}

async function createTask({
  projectId,
  currentUserId,
  userId,
  title,
  status,
  startDate,
  dueDate,
  description,
  priority,
  customFields,
  reminderOffsets,
  recurrence,
  qualify = false,
}: {
  projectId: string;
  currentUserId: string;
  userId?: string;
  title: string;
  status: string;
  startDate?: Date;
  dueDate?: Date;
  description?: string;
  priority?: string;
  customFields?: CustomFieldInput[];
  reminderOffsets?: number[] | null;
  recurrence?: RecurrenceRule | null;
  qualify?: boolean;
}) {
  const resolvedStatus = status || "to-do";
  const normalizedCustomFields = deduplicateCustomFields(customFields);

  const normalizedUserId = userId?.trim() || undefined;

  // Auto-qualification (opt-in per caller, so internal clones such as
  // recurrence occurrences keep their source values): Jev reads the task and
  // picks the priority and semantic labels when a TypeSafe key is configured.
  let qualification: TaskQualification | null = null;
  let workspaceId: string | undefined;
  if (qualify && isJevEnabled()) {
    const context = await loadQualificationContext(projectId);
    workspaceId = context.workspaceId;
    qualification = await suggestTaskQualification({
      title,
      description,
      projectName: context.projectName,
      workspaceName: context.workspaceName,
      labels: context.labels,
      providedPriority: priority,
    });
  }

  const resolvedPriority = qualification?.priority ?? priority ?? "no-priority";

  await assertValidTaskStatus(resolvedStatus, projectId);

  const allFields = await db
    .select()
    .from(customFieldDefinitionTable)
    .where(eq(customFieldDefinitionTable.projectId, projectId));

  const mergedCustomFields: CustomFieldInput[] = normalizedCustomFields ?? [];
  const providedFieldIds = new Set(mergedCustomFields.map((f) => f.fieldId));

  for (const field of allFields) {
    if (
      !providedFieldIds.has(field.id) &&
      field.required &&
      field.defaultValue != null &&
      field.defaultValue.trim() !== ""
    ) {
      mergedCustomFields.push({
        fieldId: field.id,
        value: field.defaultValue,
      });
    }
  }

  await assertRequiredCustomFields(projectId, mergedCustomFields);

  let assignee: { name: string } | undefined;

  if (normalizedUserId) {
    await assertAssignableUser(normalizedUserId, projectId);

    [assignee] = await db
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, normalizedUserId));
  }

  const column = await db.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, projectId),
      eq(columnTable.slug, resolvedStatus),
    ),
  });

  const [maxPositionResult] = await db
    .select({ maxPosition: max(taskTable.position) })
    .from(taskTable)
    .where(
      and(
        eq(taskTable.projectId, projectId),
        column?.id
          ? eq(taskTable.columnId, column.id)
          : eq(taskTable.status, resolvedStatus),
      ),
    );

  const nextPosition = (maxPositionResult?.maxPosition ?? 0) + 1;

  const createdTask = await db.transaction(async (tx) => {
    const taskNumber = await claimTaskNumber(projectId, tx);

    const [task] = await tx
      .insert(taskTable)
      .values({
        projectId,
        userId: normalizedUserId ?? null,
        title: title || "",
        status: resolvedStatus,
        columnId: column?.id ?? null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        reminderOffsets: reminderOffsets ?? null,
        recurrence: recurrence ?? null,
        description: description || "",
        priority: resolvedPriority,
        number: taskNumber,
        position: nextPosition,
      })
      .returning();

    if (task && mergedCustomFields.length) {
      await tx.insert(customFieldValueTable).values(
        mergedCustomFields.map(({ fieldId, value }) => ({
          taskId: task.id,
          fieldId,
          value: value.trim(),
        })),
      );
    }

    return task;
  });

  if (!createdTask) {
    throw new HTTPException(500, {
      message: "Failed to create task",
    });
  }

  await publishEvent("task.created", {
    ...createdTask,
    taskId: createdTask.id,
    userId: createdTask.userId ?? "",
    currentUserId: currentUserId,
    type: "created",
    content: null,
  });

  // The qualification labels are attached after the task exists; the returned
  // task carries them so callers see what was applied.
  const labels = await attachQualificationLabels(
    qualification,
    createdTask.id,
    workspaceId,
    currentUserId,
  );

  return {
    ...createdTask,
    assigneeName: assignee?.name,
    labels,
  };
}

export default createTask;
