import { and, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import db from "../database";
import { labelTable } from "../database/schema";

const canonicalLabel = alias(labelTable, "canonical_label");

/**
 * A label name identifies a single label per workspace; task-level copies are
 * per-task attachments of that label and must mirror its color. Legacy data
 * predating the update-label cascade can hold copies whose color drifted from
 * the workspace definition (e.g. a hex-formatted copy of a semantic-color
 * label), which then splits label groups and filters. One idempotent pass
 * re-syncs every drifted copy to its workspace definition's color.
 */
export async function migrateLabelColors() {
  const drifted = await db
    .select({
      id: labelTable.id,
      canonicalColor: canonicalLabel.color,
    })
    .from(labelTable)
    .innerJoin(
      canonicalLabel,
      and(
        eq(canonicalLabel.workspaceId, labelTable.workspaceId),
        eq(canonicalLabel.name, labelTable.name),
        isNull(canonicalLabel.taskId),
      ),
    )
    .where(
      and(
        isNotNull(labelTable.taskId),
        isNotNull(labelTable.workspaceId),
        ne(labelTable.color, sql`${canonicalLabel.color}`),
      ),
    );

  if (drifted.length === 0) {
    return;
  }

  for (const row of drifted) {
    await db
      .update(labelTable)
      .set({ color: row.canonicalColor })
      .where(eq(labelTable.id, row.id));
  }

  console.log(
    `✅ Label color migration: synced ${drifted.length} task-level label copies to their workspace label color`,
  );
}
