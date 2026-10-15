import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { milestoneTable, taskTable } from "../../database/schema";

// Tasks assigned to the milestone keep existing: they are detached first, so
// the delete never trips the task.milestone_id foreign key. (SQLite cannot
// add a column with ON DELETE SET NULL through ALTER TABLE, so the schema's
// intent is enforced here, explicitly and transactionally.)
async function deleteMilestone(id: string) {
  const [deleted] = await db.transaction(async (tx) => {
    const existing = await tx.query.milestoneTable.findFirst({
      where: eq(milestoneTable.id, id),
    });
    if (!existing) {
      return [];
    }

    await tx
      .update(taskTable)
      .set({ milestoneId: null })
      .where(eq(taskTable.milestoneId, id));

    return tx
      .delete(milestoneTable)
      .where(eq(milestoneTable.id, id))
      .returning();
  });

  if (!deleted) {
    throw new HTTPException(404, { message: "Milestone not found" });
  }

  return deleted;
}

export default deleteMilestone;
