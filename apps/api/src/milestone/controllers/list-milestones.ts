import { asc, eq } from "drizzle-orm";
import db from "../../database";
import { milestoneTable } from "../../database/schema";

async function listMilestones(projectId: string) {
  return db
    .select()
    .from(milestoneTable)
    .where(eq(milestoneTable.projectId, projectId))
    .orderBy(asc(milestoneTable.position), asc(milestoneTable.createdAt));
}

export default listMilestones;
