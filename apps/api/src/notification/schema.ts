import { z } from "../openapi";
import { listPagingQuery } from "../utils/paging";

export const notificationParam = z.object({ id: z.string() });

export const notificationWorkspaceQuery = z.object({
  workspaceId: z.string().min(1).optional().openapi({
    description:
      "Limit notifications to resources currently in this workspace, plus user-wide notifications with no resource. Omit to include all workspaces.",
  }),
});

// The list endpoint pages like the rest of the API; the bulk endpoints only
// take the workspace filter.
export const notificationListQuery = listPagingQuery.extend(
  notificationWorkspaceQuery.shape,
);

export const createNotificationBody = z.object({
  title: z.string().nullable().optional(),
  message: z.string().nullable().optional().openapi({
    description: "Stored as the notification's content.",
  }),
  type: z.string(),
  eventData: z.record(z.string(), z.unknown()).nullable().optional(),
  relatedEntityId: z.string().optional().openapi({
    description:
      "Stored as resourceId: the task or workspace being pointed at.",
  }),
  relatedEntityType: z.string().optional().openapi({
    description: "Stored as resourceType: `task` or `workspace`.",
  }),
});
