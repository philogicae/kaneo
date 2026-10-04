import { and, asc, eq, isNotNull } from "drizzle-orm";
import db from "../../database";
import { activityTable, userTable } from "../../database/schema";

async function getComments(
  taskId: string,
  options: { limit?: number; offset?: number } = {},
) {
  const query = db
    .select({
      id: activityTable.id,
      taskId: activityTable.taskId,
      userId: userTable.id,
      content: activityTable.content,
      createdAt: activityTable.createdAt,
      updatedAt: activityTable.updatedAt,
      userName: userTable.name,
      userImage: userTable.image,
    })
    .from(activityTable)
    .innerJoin(userTable, eq(activityTable.userId, userTable.id))
    .where(
      and(
        eq(activityTable.taskId, taskId),
        eq(activityTable.type, "comment"),
        isNotNull(activityTable.userId),
        isNotNull(activityTable.content),
      ),
    )
    .orderBy(asc(activityTable.createdAt))
    // -1 disables the upper bound so an offset-only caller still gets a valid
    // SQLite query (OFFSET alone is not valid without LIMIT).
    .limit(options.limit ?? -1);

  const comments =
    options.offset !== undefined
      ? await query.offset(options.offset)
      : await query;

  return comments.map((c) => ({
    id: c.id,
    taskId: c.taskId,
    userId: c.userId,
    content: c.content as string,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    user: {
      name: c.userName,
      image: c.userImage,
    },
  }));
}

export default getComments;
