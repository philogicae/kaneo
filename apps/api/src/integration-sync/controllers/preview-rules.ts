import { createHash } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import db from "../../database";
import { externalLinkTable, taskTable } from "../../database/schema";
import type { IntegrationDatabase } from "../../plugins/github/services/integration-task-scope";
import { readSyncRules, type SyncRules } from "../../plugins/sync/rules";
import { outgoingPredicate } from "../../plugins/sync/task-predicate";
import type { getSyncIntegration } from "./get-integration";

export async function previewSyncRules(
  integration: Awaited<ReturnType<typeof getSyncIntegration>>,
  rules: SyncRules,
  database: IntegrationDatabase = db,
  after?: string,
) {
  const proposed = await outgoingPredicate(
    integration.project.workspaceId,
    rules.outgoing,
    database,
    true,
  );
  const current = await outgoingPredicate(
    integration.project.workspaceId,
    readSyncRules(integration.config)!.outgoing,
    database,
  );
  const paused = sql<boolean>`coalesce(json_extract(case when json_valid(${externalLinkTable.metadata}) then ${externalLinkTable.metadata} end, '$.syncFilterPaused'), 0) = 1`;
  const initializing = sql<boolean>`coalesce(json_extract(case when json_valid(${externalLinkTable.metadata}) then ${externalLinkTable.metadata} end, '$.syncInitializationPending'), 0) = 1`;
  // libSQL has no DISTINCT ON, md5 or ordered string_agg: the scope rows are
  // deduplicated, counted and hashed here from one ordered read instead.
  const rawRows = await database
    .select({
      id: taskTable.id,
      number: taskTable.number,
      title: taskTable.title,
      eligible: proposed.predicate.as("eligible"),
      current: current.predicate.as("current"),
      linkId: sql<string | null>`${externalLinkTable.id}`.as("link_id"),
      url: externalLinkTable.url,
      paused: paused.as("paused"),
      initializing: initializing.as("initializing"),
    })
    .from(taskTable)
    .leftJoin(
      externalLinkTable,
      and(
        eq(externalLinkTable.taskId, taskTable.id),
        eq(externalLinkTable.integrationId, integration.id),
        eq(externalLinkTable.resourceType, "issue"),
      ),
    )
    .where(eq(taskTable.projectId, integration.projectId))
    .orderBy(asc(taskTable.id), desc(paused), asc(externalLinkTable.id));

  // Keep the preferred link row per task: the first row in this order, i.e.
  // the earliest non-paused link, falling back to the earliest link.
  const scopeRows: typeof rawRows = [];
  const seenTasks = new Set<string>();
  for (const row of rawRows) {
    if (seenTasks.has(row.id)) continue;
    seenTasks.add(row.id);
    scopeRows.push(row);
  }

  let matching = 0;
  let willCreate = 0;
  let willPause = 0;
  let needsReview = 0;
  let pausedCount = 0;
  const revisionRows: Array<
    [string, boolean, boolean, string | null, string | null, boolean, boolean]
  > = [];
  const matchingTasks: Array<{
    id: string;
    number: number | null;
    title: string;
  }> = [];
  const pausedTasks: Array<{
    id: string;
    number: number | null;
    title: string;
    linkId: string;
    url: string;
    eligible: boolean;
  }> = [];
  for (const row of scopeRows) {
    const eligible = Boolean(row.eligible);
    const isCurrent = Boolean(row.current);
    const isPaused = Boolean(row.paused);
    const isInitializing = Boolean(row.initializing);
    if (eligible) matching++;
    if (eligible && (row.linkId === null || (isInitializing && !isPaused)))
      willCreate++;
    if (row.linkId !== null && !eligible && !isPaused) willPause++;
    if (row.linkId !== null && eligible && (isPaused || !isCurrent))
      needsReview++;
    if (row.linkId !== null && (!eligible || isPaused)) pausedCount++;
    revisionRows.push([
      row.id,
      eligible,
      isCurrent,
      row.linkId,
      row.url,
      isPaused,
      isInitializing,
    ]);
    if (eligible && matchingTasks.length < 10)
      matchingTasks.push({ id: row.id, number: row.number, title: row.title });
    const linkId = row.linkId;
    if (
      linkId !== null &&
      (!eligible || isPaused) &&
      (!after || row.id > after) &&
      pausedTasks.length < 26
    )
      pausedTasks.push({
        id: row.id,
        number: row.number,
        title: row.title,
        linkId,
        url: row.url ?? "",
        eligible,
      });
  }
  // Order-independent because the rows are read in id order above.
  const revision = createHash("sha256")
    .update(JSON.stringify(revisionRows))
    .digest("hex");

  const selectedLabelIds =
    rules.outgoing.mode === "labels" ? rules.outgoing.labels : [];
  const previewToken = createHash("sha256")
    .update(
      JSON.stringify({
        integration: [integration.id, integration.config, integration.isActive],
        rules,
        labels: proposed.labels
          .filter((label) => selectedLabelIds.includes(label.id))
          .map(({ id, name }) => [id, name]),
        revision,
      }),
    )
    .digest("hex");

  return {
    isActive: integration.isActive === true,
    rules,
    labels: proposed.labels,
    missingLabels: proposed.missing,
    total: scopeRows.length,
    matching,
    willCreate,
    willPause,
    needsReview,
    paused: pausedCount,
    matchingTasks,
    pausedNextCursor: pausedTasks.length > 25 ? pausedTasks[24]!.id : null,
    pausedTasks: pausedTasks.slice(0, 25),
    previewToken,
  };
}
