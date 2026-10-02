import type { InferSelectModel } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
import db from "../../../database";
import {
  columnTable,
  integrationTable,
  taskTable,
} from "../../../database/schema";
import { type GitHubConfig, hasVerifiedGitHubBinding } from "../config";
import { extractTaskLinks } from "../utils/task-references";

import type { IntegrationDatabase } from "./integration-task-scope";

export type TaskRow = InferSelectModel<typeof taskTable>;

export type UpdateTaskStatusResult =
  | { applied: false }
  | { applied: true; before: TaskRow; after: TaskRow };

const NON_COLUMN_STATUSES = new Set(["planned", "archived"]);

export async function findTaskByNumber(
  projectId: string,
  taskNumber: number,
  database: Pick<typeof db, "query"> = db,
) {
  return database.query.taskTable.findFirst({
    where: and(
      eq(taskTable.projectId, projectId),
      eq(taskTable.number, taskNumber),
    ),
  });
}

export async function findTaskByLink(
  projectId: string,
  texts: (string | null | undefined)[],
  database: Pick<typeof db, "query"> = db,
) {
  const links = extractTaskLinks(...texts);
  const link = links.length === 1 ? links[0] : undefined;
  if (link?.projectId !== projectId) return;

  return database.query.taskTable.findFirst({
    where: and(
      eq(taskTable.projectId, projectId),
      eq(taskTable.id, link.taskId),
    ),
  });
}

export async function findTaskById(
  taskId: string,
  database: Pick<typeof db, "query"> = db,
) {
  return database.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });
}

export async function updateTaskStatus(
  taskId: string,
  newStatus: string,
  database: IntegrationDatabase = db,
): Promise<UpdateTaskStatusResult> {
  const task = await database.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });

  if (!task) {
    return { applied: false };
  }

  let columnId: string | null = null;

  const column = await database.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, task.projectId),
      eq(columnTable.slug, newStatus),
    ),
  });

  if (column) {
    columnId = column.id;
  } else if (!NON_COLUMN_STATUSES.has(newStatus)) {
    console.warn(
      `[GitHub] Skipping status update for task ${taskId}: column "${newStatus}" not found in project ${task.projectId}`,
    );
    return { applied: false };
  }

  const [after] = await database
    .update(taskTable)
    .set({ status: newStatus, columnId })
    .where(
      and(eq(taskTable.id, taskId), eq(taskTable.projectId, task.projectId)),
    )
    .returning();

  if (!after) {
    return { applied: false };
  }

  return { applied: true, before: task, after };
}

export async function isTaskInFinalState(
  task: {
    projectId: string;
    status: string;
    columnId: string | null;
  },
  database: Pick<typeof db, "query"> = db,
): Promise<boolean> {
  if (task.columnId) {
    const columnById = await database.query.columnTable.findFirst({
      where: and(
        eq(columnTable.id, task.columnId),
        eq(columnTable.projectId, task.projectId),
      ),
    });

    if (columnById) {
      return columnById.isFinal;
    }
  }

  const columnByStatus = await database.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, task.projectId),
      eq(columnTable.slug, task.status),
    ),
  });

  if (columnByStatus) {
    return columnByStatus.isFinal;
  }

  return task.status === "done";
}

export async function getIntegrationWithProject(integrationId: string) {
  return db.query.integrationTable.findFirst({
    where: eq(integrationTable.id, integrationId),
    with: {
      project: true,
    },
  });
}

export type GitHubWebhookSource = {
  installation?: { id: number };
  repository: { id: number };
};

/**
 * Identify an integration from a webhook payload.
 *
 * A payload that carries GitHub's numeric ids is matched on those, which is
 * exact. A payload that only names the repository (older webhooks, and the
 * self-hosted forge integrations) falls back to the stored owner/name pair.
 */
export function integrationMatchesSource(
  integration: { config: string },
  source: GitHubWebhookSource | { owner: string; repo: string },
): boolean {
  let config: GitHubConfig;
  try {
    config = JSON.parse(integration.config) as GitHubConfig;
  } catch {
    return false;
  }

  // A binding that was never verified must never receive webhook deliveries:
  // matching on the repository name alone is not proof of ownership.
  if (!hasVerifiedGitHubBinding(config)) return false;

  if ("owner" in source) {
    return (
      config.repositoryOwner === source.owner &&
      config.repositoryName === source.repo
    );
  }
  return (
    config.repositoryId === source.repository.id &&
    (source.installation?.id === undefined ||
      config.installationId === source.installation.id)
  );
}

export async function findAllIntegrationsByRepo(
  source: GitHubWebhookSource | { owner: string; repo: string },
) {
  // A payload without an installation id cannot identify a binding, so no
  // tenant data is read for it.
  if (
    "owner" in source === false &&
    !Number.isSafeInteger(source.installation?.id)
  ) {
    return [];
  }

  const integrations = await db.query.integrationTable.findMany({
    where: and(
      eq(integrationTable.type, "github"),
      eq(integrationTable.isActive, true),
    ),
    with: { project: true },
  });

  return integrations.filter((integration) =>
    integrationMatchesSource(integration, source),
  );
}
