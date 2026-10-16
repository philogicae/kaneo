import { and, asc, eq, gt, inArray, sql, type SQL } from "drizzle-orm";
import { externalLinkTable, taskTable } from "../../database/schema";
import type { IntegrationDatabase } from "../github/services/integration-task-scope";

const pausedFlag = sql`coalesce(json_extract(case when json_valid(${externalLinkTable.metadata}) then ${externalLinkTable.metadata} end, '$.syncFilterPaused'), 0) = 1`;

export async function pauseIssueLinks(
  projectId: string,
  integrationId: string,
  excluded: SQL,
  tx: IntegrationDatabase,
) {
  let cursor: string | undefined;
  for (;;) {
    const links = await tx
      .select({ id: externalLinkTable.id })
      .from(externalLinkTable)
      .innerJoin(taskTable, eq(taskTable.id, externalLinkTable.taskId))
      .where(
        and(
          eq(externalLinkTable.integrationId, integrationId),
          eq(externalLinkTable.resourceType, "issue"),
          eq(taskTable.projectId, projectId),
          excluded,
          cursor ? gt(externalLinkTable.id, cursor) : undefined,
          sql`not ${pausedFlag}`,
        ),
      )
      .orderBy(asc(externalLinkTable.id))
      .limit(100);
    if (!links.length) return;
    // One update per bounded page; json_set keeps the other metadata keys.
    await tx.run(
      sql`update ${externalLinkTable} set metadata = json_set(coalesce(case when json_valid(${externalLinkTable.metadata}) then ${externalLinkTable.metadata} end, '{}'), '$.syncFilterPaused', json('true')), updated_at = ${Date.now()} where ${inArray(
        externalLinkTable.id,
        links.map((link) => link.id),
      )}`,
    );
    cursor = links.at(-1)!.id;
  }
}
