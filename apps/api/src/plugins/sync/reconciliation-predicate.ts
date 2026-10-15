import { and, not, or, sql, type SQL } from "drizzle-orm";
import { externalLinkTable, taskTable } from "../../database/schema";

// libSQL has no regex operator; the metadata flags are JSON booleans.
const metadataFlag = (name: string) =>
  sql`coalesce(json_extract(case when json_valid(scoped_link.metadata) then scoped_link.metadata end, ${`$.${name}`}), 0) = 1`;

export function reconciliationPredicate(integrationId: string, outgoing: SQL) {
  const linked = sql<boolean>`exists (
    select 1 from ${externalLinkTable} scoped_link
    where scoped_link.task_id = ${taskTable.id}
      and scoped_link.integration_id = ${integrationId}
      and scoped_link.resource_type = 'issue'
  )`;
  const pending = sql<boolean>`exists (
    select 1 from ${externalLinkTable} scoped_link
    where scoped_link.task_id = ${taskTable.id}
      and scoped_link.integration_id = ${integrationId}
      and scoped_link.resource_type = 'issue'
      and ${metadataFlag("syncInitializationPending")}
      and not ${metadataFlag("syncFilterPaused")}
  )`;
  const unpaused = sql<boolean>`exists (
    select 1 from ${externalLinkTable} scoped_link
    where scoped_link.task_id = ${taskTable.id}
      and scoped_link.integration_id = ${integrationId}
      and scoped_link.resource_type = 'issue'
      and not ${metadataFlag("syncFilterPaused")}
  )`;
  // Label renames and reconnects also use reconciliation, so excluded links
  // still need pausing even when no rule-save transaction ran beforehand.
  return or(
    and(outgoing, or(not(linked), pending)),
    and(not(outgoing), unpaused),
  );
}
