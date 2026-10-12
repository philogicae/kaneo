import { z } from "../openapi";

export const integrationEventsSchema = z
  .object({
    taskCreated: z.boolean(),
    taskStatusChanged: z.boolean(),
    taskPriorityChanged: z.boolean(),
    taskTitleChanged: z.boolean(),
    taskDescriptionChanged: z.boolean(),
    taskCommentCreated: z.boolean(),
  })
  .openapi("IntegrationEvents");

// Discord, Slack and the per-project Telegram integration separate comments
// from @mentions, so their event filter carries one extra key.
export const mentionIntegrationEventsSchema = integrationEventsSchema
  .extend({
    taskMentionCreated: z.boolean(),
  })
  .openapi("MentionIntegrationEvents");

export const genericWebhookEventsSchema = integrationEventsSchema
  .extend({
    taskDeleted: z.boolean(),
    taskMoved: z.boolean(),
    taskDueDateChanged: z.boolean(),
    taskAssigneeChanged: z.boolean(),
    taskUnassigned: z.boolean(),
    dueDateReminder: z.boolean(),
  })
  .openapi("GenericWebhookEvents");
