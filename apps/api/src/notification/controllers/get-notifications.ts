import { and, desc, eq } from "drizzle-orm";
import db from "../../database";
import {
  notificationTable,
  projectTable,
  taskTable,
  workspaceTable,
} from "../../database/schema";
import { notificationResourceAccess } from "../resource-access";

async function getNotifications(
  userId: string,
  paging: { limit?: number; offset?: number } = {},
) {
  const rows = await db
    .select({
      notification: notificationTable,
      projectId: projectTable.id,
      workspaceId: workspaceTable.id,
    })
    .from(notificationTable)
    .leftJoin(
      taskTable,
      and(
        eq(notificationTable.resourceId, taskTable.id),
        eq(notificationTable.resourceType, "task"),
      ),
    )
    .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
    // Historical rows are filtered at read time too: a forged or stale
    // reference must not be enriched now that creation is guarded.
    .where(
      and(
        eq(notificationTable.userId, userId),
        notificationResourceAccess(
          userId,
          notificationTable.resourceId,
          notificationTable.resourceType,
        ),
      ),
    )
    .orderBy(desc(notificationTable.createdAt))
    .limit(paging.limit ?? 50)
    .offset(paging.offset ?? 0);

  return rows.map(({ notification, projectId, workspaceId }) => {
    if (!projectId && !workspaceId) {
      return notification;
    }

    const existing =
      notification.eventData &&
      typeof notification.eventData === "object" &&
      !Array.isArray(notification.eventData)
        ? (notification.eventData as Record<string, unknown>)
        : {};

    return {
      ...notification,
      eventData: {
        ...existing,
        projectId: projectId ?? existing.projectId ?? null,
        workspaceId: workspaceId ?? existing.workspaceId ?? null,
      },
    };
  });
}

export default getNotifications;
