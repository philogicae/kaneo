import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import db from "../../database";
import { taskRelationTable, taskTable } from "../../database/schema";

const sourceTask = alias(taskTable, "source_task");
const targetTask = alias(taskTable, "target_task");

// Every relation whose two endpoints both live in the project. The roadmap
// reads this once instead of fetching relations per task; relations pointing
// outside the project are not part of its graph.
async function getProjectRelations(projectId: string) {
  return db
    .select({
      id: taskRelationTable.id,
      sourceTaskId: taskRelationTable.sourceTaskId,
      targetTaskId: taskRelationTable.targetTaskId,
      relationType: taskRelationTable.relationType,
      createdAt: taskRelationTable.createdAt,
    })
    .from(taskRelationTable)
    .innerJoin(sourceTask, eq(taskRelationTable.sourceTaskId, sourceTask.id))
    .innerJoin(targetTask, eq(taskRelationTable.targetTaskId, targetTask.id))
    .where(
      and(
        eq(sourceTask.projectId, projectId),
        eq(targetTask.projectId, projectId),
      ),
    );
}

export default getProjectRelations;
