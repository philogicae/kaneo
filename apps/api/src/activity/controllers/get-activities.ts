import { desc, eq } from "drizzle-orm";
import db from "../../database";
import { activityTable } from "../../database/schema";

async function getActivitiesFromTaskId(
  taskId: string,
  options: { limit?: number; offset?: number } = {},
) {
  const activities = await db.query.activityTable.findMany({
    where: eq(activityTable.taskId, taskId),
    // The id tiebreaker keeps the order stable across pages when several events
    // share a created_at, so an offset cannot repeat or skip a row.
    orderBy: [desc(activityTable.createdAt), desc(activityTable.id)],
    // -1 disables the upper bound so an offset-only caller still gets a valid
    // SQLite query (OFFSET alone is not valid without LIMIT).
    limit: options.limit ?? -1,
    ...(options.offset !== undefined ? { offset: options.offset } : {}),
  });

  activities.forEach((x) => {
    if (x.content && x.type !== "comment") {
      x.content = x.content.replace(/\n+/g, "\n");
    }
  });

  return activities;
}

export default getActivitiesFromTaskId;
