import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { milestoneTable } from "../../database/schema";

// Reordering must include every milestone of the project exactly once; the
// web sends the full list after a drag so a partial update cannot leave two
// milestones sharing a position.
async function reorderMilestones(
  projectId: string,
  milestones: Array<{ id: string; position: number }>,
) {
  const existing = await db
    .select({ id: milestoneTable.id })
    .from(milestoneTable)
    .where(eq(milestoneTable.projectId, projectId));

  const existingIds = new Set(existing.map((row) => row.id));
  const providedIds = new Set(milestones.map((row) => row.id));

  if (
    existingIds.size !== providedIds.size ||
    [...existingIds].some((id) => !providedIds.has(id))
  ) {
    throw new HTTPException(400, {
      message: "Reordering must include every milestone of the project once",
    });
  }

  await db.transaction(async (tx) => {
    for (const entry of milestones) {
      await tx
        .update(milestoneTable)
        .set({ position: entry.position })
        .where(
          and(
            eq(milestoneTable.id, entry.id),
            eq(milestoneTable.projectId, projectId),
          ),
        );
    }
  });

  return db
    .select()
    .from(milestoneTable)
    .where(eq(milestoneTable.projectId, projectId))
    .orderBy(milestoneTable.position);
}

export default reorderMilestones;
