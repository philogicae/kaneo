import { eq } from "drizzle-orm";
import db from "../../database";
import { timeEntryTable, userTable } from "../../database/schema";

async function getTimeEntriesByTaskId(
  taskId: string,
  options: { limit?: number; offset?: number } = {},
) {
  const query = db
    .select({
      id: timeEntryTable.id,
      taskId: timeEntryTable.taskId,
      userId: timeEntryTable.userId,
      userName: userTable.name,
      description: timeEntryTable.description,
      startTime: timeEntryTable.startTime,
      endTime: timeEntryTable.endTime,
      duration: timeEntryTable.duration,
      createdAt: timeEntryTable.createdAt,
      updatedAt: timeEntryTable.updatedAt,
    })
    .from(timeEntryTable)
    .leftJoin(userTable, eq(timeEntryTable.userId, userTable.id))
    .where(eq(timeEntryTable.taskId, taskId))
    .orderBy(timeEntryTable.startTime)
    // -1 disables the upper bound so an offset-only caller still gets a valid
    // SQLite query (OFFSET alone is not valid without LIMIT).
    .limit(options.limit ?? -1);

  return options.offset !== undefined ? query.offset(options.offset) : query;
}

export default getTimeEntriesByTaskId;
