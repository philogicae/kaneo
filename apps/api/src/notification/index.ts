import { eq } from "drizzle-orm";
import db from "../database";
import { projectTable, taskTable } from "../database/schema";
import { subscribeToEvent } from "../events";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import clearNotifications from "./controllers/clear-notifications";
import createNotification from "./controllers/create-notification";
import getNotifications from "./controllers/get-notifications";
import markAllNotificationsAsRead from "./controllers/mark-all-notifications-as-read";
import markAsRead from "./controllers/mark-notification-as-read";
import {
  bulkResultSchema,
  notificationListSchema,
  notificationSchema,
} from "./response";
import {
  createNotificationBody,
  notificationListQuery,
  notificationParam,
} from "./schema";

const listNotificationsRoute = createRoute({
  method: "get",
  operationId: "listNotifications",
  path: "/",
  tags: ["Notifications"],
  summary: "List notifications",
  description:
    "Get the current user's notifications, newest first. Paginated: limit (default 50, max 200) and offset.",
  request: { query: notificationListQuery },
  responses: {
    200: jsonResponse("List of notifications", notificationListSchema),
  },
});

const createNotificationRoute = createRoute({
  method: "post",
  operationId: "createNotification",
  path: "/",
  tags: ["Notifications"],
  summary: "Create notification",
  description:
    "Create a notification for the current user. Most notifications are raised by the server from task and workspace events; this exists for integrations. Returns null when the user has turned off this notification category in their preferences.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createNotificationBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The created notification, or null when the user has muted this notification type",
      notificationSchema.nullable(),
    ),
    400: errorResponse("Invalid request"),
  },
});

const markAsReadRoute = createRoute({
  method: "patch",
  operationId: "markNotificationAsRead",
  path: "/{id}/read",
  tags: ["Notifications"],
  summary: "Mark notification read",
  description:
    "Mark one notification as read. Scoped to the current user, so another user's notification is not found.",
  request: { params: notificationParam },
  responses: {
    200: jsonResponse("The updated notification", notificationSchema),
    404: errorResponse("Notification not found"),
  },
});

const markAllAsReadRoute = createRoute({
  method: "patch",
  operationId: "markAllNotificationsAsRead",
  path: "/read-all",
  tags: ["Notifications"],
  summary: "Mark all read",
  description: "Mark every notification for the current user as read.",
  responses: {
    200: jsonResponse("All notifications marked as read", bulkResultSchema),
  },
});

const clearAllRoute = createRoute({
  method: "delete",
  operationId: "clearAllNotifications",
  path: "/clear-all",
  tags: ["Notifications"],
  summary: "Clear all",
  description:
    "Permanently delete every notification for the current user. This cannot be undone.",
  responses: {
    200: jsonResponse("All notifications cleared", bulkResultSchema),
  },
});

const notification = apiRouter()
  .openapi(listNotificationsRoute, async (c) => {
    const { limit, offset } = c.req.valid("query");
    return c.json(
      await getNotifications(c.get("userId"), { limit, offset }),
      200,
    );
  })
  .openapi(createNotificationRoute, async (c) => {
    const {
      title,
      message,
      type,
      eventData,
      relatedEntityId,
      relatedEntityType,
    } = c.req.valid("json");
    return c.json(
      await createNotification({
        userId: c.get("userId"),
        title,
        content: message,
        type,
        eventData,
        resourceId: relatedEntityId,
        resourceType: relatedEntityType,
      }),
      200,
    );
  })
  .openapi(markAsReadRoute, async (c) =>
    c.json(await markAsRead(c.req.valid("param").id, c.get("userId")), 200),
  )
  .openapi(markAllAsReadRoute, async (c) =>
    c.json(await markAllNotificationsAsRead(c.get("userId")), 200),
  )
  .openapi(clearAllRoute, async (c) =>
    c.json(await clearNotifications(c.get("userId")), 200),
  );

subscribeToEvent<{
  taskId: string;
  userId: string;
  currentUserId?: string;
  title: string;
  projectId: string;
}>("task.created", async (data) => {
  if (data.userId && data.userId !== data.currentUserId) {
    const [project] = await db
      .select({ workspaceId: projectTable.workspaceId })
      .from(projectTable)
      .where(eq(projectTable.id, data.projectId))
      .limit(1);

    await createNotification({
      userId: data.userId,
      type: "task_created",
      eventData: {
        taskTitle: data.title,
        projectId: data.projectId,
        workspaceId: project?.workspaceId ?? null,
      },
      resourceId: data.taskId,
      resourceType: "task",
      projectId: data.projectId,
    });
  }
});

subscribeToEvent<{
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string;
  ownerId?: string;
}>("workspace.created", async (data) => {
  if (data.ownerId) {
    await createNotification({
      userId: data.ownerId,
      type: "workspace_created",
      eventData: {
        workspaceName: data.workspaceName,
      },
      resourceId: data.workspaceId,
      resourceType: "workspace",
    });
  }
});

subscribeToEvent<{
  taskId: string;
  userId: string;
  oldStatus: string;
  newStatus: string;
  title: string;
  assigneeId?: string;
}>("task.status_changed", async (data) => {
  if (data.assigneeId && data.assigneeId !== data.userId) {
    const [task] = await db
      .select({ projectId: taskTable.projectId })
      .from(taskTable)
      .where(eq(taskTable.id, data.taskId))
      .limit(1);

    const [project] = task
      ? await db
          .select({ workspaceId: projectTable.workspaceId })
          .from(projectTable)
          .where(eq(projectTable.id, task.projectId))
          .limit(1)
      : [];

    await createNotification({
      userId: data.assigneeId,
      type: "task_status_changed",
      eventData: {
        taskTitle: data.title,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        projectId: task?.projectId ?? null,
        workspaceId: project?.workspaceId ?? null,
      },
      resourceId: data.taskId,
      resourceType: "task",
      projectId: task?.projectId ?? null,
    });
  }
});

subscribeToEvent<{
  taskId: string;
  userId: string;
  oldAssignee: string | null;
  newAssignee: string;
  newAssigneeId: string;
  title: string;
}>("task.assignee_changed", async (data) => {
  if (data.newAssigneeId) {
    const [task] = await db
      .select({ projectId: taskTable.projectId })
      .from(taskTable)
      .where(eq(taskTable.id, data.taskId))
      .limit(1);

    const [project] = task
      ? await db
          .select({ workspaceId: projectTable.workspaceId })
          .from(projectTable)
          .where(eq(projectTable.id, task.projectId))
          .limit(1)
      : [];

    await createNotification({
      userId: data.newAssigneeId,
      type: "task_assignee_changed",
      eventData: {
        taskTitle: data.title,
        projectId: task?.projectId ?? null,
        workspaceId: project?.workspaceId ?? null,
      },
      resourceId: data.taskId,
      resourceType: "task",
      projectId: task?.projectId ?? null,
    });
  }
});

subscribeToEvent<{
  timeEntryId: string;
  taskId: string;
  userId: string;
  taskOwnerId?: string;
  taskTitle?: string;
}>("time-entry.created", async (data) => {
  if (data.taskOwnerId && data.taskOwnerId !== data.userId) {
    const [task] = await db
      .select({ projectId: taskTable.projectId })
      .from(taskTable)
      .where(eq(taskTable.id, data.taskId))
      .limit(1);

    const [project] = task
      ? await db
          .select({ workspaceId: projectTable.workspaceId })
          .from(projectTable)
          .where(eq(projectTable.id, task.projectId))
          .limit(1)
      : [];

    await createNotification({
      userId: data.taskOwnerId,
      type: "time_entry_created",
      eventData: {
        taskTitle: data.taskTitle ?? null,
        projectId: task?.projectId ?? null,
        workspaceId: project?.workspaceId ?? null,
      },
      resourceId: data.taskId,
      resourceType: "task",
      projectId: task?.projectId ?? null,
    });
  }
});

function toTimestamp(value: Date | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

subscribeToEvent<{
  appointmentId: string;
  projectId: string;
  userId: string;
  currentUserId?: string;
  title: string;
}>("appointment.created", async (data) => {
  if (data.userId && data.userId !== data.currentUserId) {
    const [project] = await db
      .select({ workspaceId: projectTable.workspaceId })
      .from(projectTable)
      .where(eq(projectTable.id, data.projectId))
      .limit(1);

    await createNotification({
      userId: data.userId,
      type: "appointment_created",
      eventData: {
        appointmentTitle: data.title,
        projectId: data.projectId,
        workspaceId: project?.workspaceId ?? null,
      },
      resourceId: data.appointmentId,
      resourceType: "appointment",
      projectId: data.projectId,
    });
  }
});

subscribeToEvent<{
  appointmentId: string;
  projectId: string;
  currentUserId?: string;
  title: string;
  oldAssigneeId: string | null;
  newAssigneeId: string | null;
  oldStartDate: Date | null;
  newStartDate: Date | null;
  oldDueDate: Date | null;
  newDueDate: Date | null;
}>("appointment.updated", async (data) => {
  const assigneeChanged = data.newAssigneeId !== data.oldAssigneeId;
  const datesChanged =
    toTimestamp(data.oldStartDate) !== toTimestamp(data.newStartDate) ||
    toTimestamp(data.oldDueDate) !== toTimestamp(data.newDueDate);

  // Appointments carry no status: only a new assignee or a reschedule is
  // worth a notification, and never to the member who made the change.
  if (!assigneeChanged && !datesChanged) {
    return;
  }
  if (!data.newAssigneeId || data.newAssigneeId === data.currentUserId) {
    return;
  }

  const [project] = await db
    .select({ workspaceId: projectTable.workspaceId })
    .from(projectTable)
    .where(eq(projectTable.id, data.projectId))
    .limit(1);

  await createNotification({
    userId: data.newAssigneeId,
    type: "appointment_updated",
    eventData: {
      appointmentTitle: data.title,
      projectId: data.projectId,
      workspaceId: project?.workspaceId ?? null,
      changeType: assigneeChanged ? "assignee" : "rescheduled",
    },
    resourceId: data.appointmentId,
    resourceType: "appointment",
    projectId: data.projectId,
  });
});

export default notification;
