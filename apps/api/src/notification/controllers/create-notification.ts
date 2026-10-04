import { createId } from "@paralleldrive/cuid2";
import db from "../../database";
import { notificationTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { deliverNotification } from "../../notification-preferences/delivery";
import { canAccessProject } from "../../utils/access-scope";
import { canReceiveResourceNotification } from "../resource-access";

export type CreateNotificationInput = {
  userId: string;
  title?: string | null;
  content?: string | null;
  type?: string;
  eventData?: Record<string, unknown> | null;
  resourceId?: string;
  resourceType?: string;
  projectId?: string | null;
};

type NotificationDatabase =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Store the notification, or return null when the recipient must not have it.
 *
 * Split from dispatch so a caller inside a transaction can persist first and
 * publish once the surrounding work has committed.
 */
export async function persistNotification(
  {
    userId,
    title,
    content,
    type,
    eventData,
    resourceId,
    resourceType,
    projectId,
  }: CreateNotificationInput,
  // A caller that already holds a transaction passes it, so the notification
  // and its surrounding work commit or roll back together.
  database: NotificationDatabase = db,
) {
  // A project-scoped notification would deep-link to a surface the recipient
  // is refused on: drop it instead of storing a dead link.
  if (projectId && !(await canAccessProject(userId, projectId))) {
    return null;
  }

  // A task- or workspace-referenced notification is only readable if the
  // recipient can reach that resource at all, so the boundary is enforced where
  // the row is created rather than only where it is read.
  if (
    !(await canReceiveResourceNotification(
      userId,
      resourceId,
      resourceType,
      database,
    ))
  ) {
    return null;
  }

  // Appointments reuse the assignment preference: they are assigned like
  // tasks and have no status of their own.
  const preferenceKey =
    type === "task_assignee_changed" ||
    type === "task_created" ||
    type === "appointment_created" ||
    type === "appointment_updated"
      ? "taskAssignmentEnabled"
      : type === "task_comment" || type === "task_mention"
        ? "taskCommentEnabled"
        : type === "task_status_changed"
          ? "taskStatusChangeEnabled"
          : type === "due_date_reminder" || type === "task_overdue"
            ? "dueDateReminderEnabled"
            : null;

  if (preferenceKey) {
    const preference =
      await database.query.userNotificationPreferenceTable.findFirst({
        where: (table, { eq }) => eq(table.userId, userId),
      });

    if (preference?.[preferenceKey] === false) {
      return null;
    }
  }

  const [notification] = await database
    .insert(notificationTable)
    .values({
      id: createId(),
      userId,
      title: title ?? null,
      content: content ?? null,
      type: type || "info",
      eventData: eventData ?? null,
      resourceId: resourceId || null,
      resourceType: resourceType || null,
    })
    .returning();

  return notification;
}

/** Publish and deliver an already-persisted notification. */
export async function dispatchNotification(
  notification: typeof notificationTable.$inferSelect,
) {
  await publishEvent("notification.created", {
    notificationId: notification.id,
    userId: notification.userId,
  });
  void deliverNotification(notification.id).catch((error) => {
    console.error("Failed to deliver notification", {
      notificationId: notification.id,
      error,
    });
  });
}

async function createNotification(data: CreateNotificationInput) {
  const notification = await persistNotification(data);
  if (notification) await dispatchNotification(notification);
  return notification;
}

export default createNotification;
