import { desc, eq } from "drizzle-orm";
import db from "../../database";
import { activityTable } from "../../database/schema";

async function getActivitiesFromTaskId(
  taskId: string,
  options: { limit?: number; offset?: number } = {},
) {
  const activities = await db.query.activityTable.findMany({
    where: eq(activityTable.taskId, taskId),
    orderBy: [desc(activityTable.createdAt)],
    // -1 disables the upper bound so an offset-only caller still gets a valid
    // SQLite query (OFFSET alone is not valid without LIMIT).
    limit: options.limit ?? -1,
    ...(options.offset !== undefined ? { offset: options.offset } : {}),
  });

  activities.forEach((x) => {
    if (x.content) {
      x.content = x.content.replace(/\n+/g, "\n");
    }
  });

  return activities;
}

export default getActivitiesFromTaskId;
