import { responseTimestamp, z } from "../openapi";

// The bot token is a bearer credential, so only a masked form is returned.
export const telegramBotEventsSchema = z
  .object({
    taskCreated: z.boolean(),
    taskStatusChanged: z.boolean(),
    taskPriorityChanged: z.boolean(),
    taskTitleChanged: z.boolean(),
    taskDescriptionChanged: z.boolean(),
    taskCommentCreated: z.boolean(),
  })
  .openapi("TelegramBotEvents", {
    description:
      "Effective per-bot event filter (defaults merged in when the stored filter omits a key).",
  });

export const telegramBotSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    name: z.string().nullable(),
    botTokenConfigured: z.boolean(),
    maskedBotToken: z.string(),
    events: telegramBotEventsSchema,
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("TelegramBot");

export const telegramChatSchema = z
  .object({
    id: z.string(),
    botId: z.string(),
    chatId: z.string(),
    label: z.string().nullable(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("TelegramChat");

export const telegramRuleSchema = z
  .object({
    id: z.string(),
    chatId: z.string(),
    workspaceId: z.string(),
    workspaceName: z.string().nullable(),
    projectId: z.string().nullable().openapi({
      description: "Null routes the whole workspace instead of one project.",
    }),
    projectName: z.string().nullable(),
    threadId: z.number().nullable().openapi({
      description: "Forum topic id, when the target group uses topics.",
    }),
    isActive: z.boolean(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("TelegramRule");

export const telegramConfigSchema = z
  .object({
    bots: z.array(
      telegramBotSchema.extend({
        chats: z.array(
          telegramChatSchema.extend({
            rules: z.array(telegramRuleSchema),
          }),
        ),
      }),
    ),
  })
  .openapi("TelegramConfig");

export const telegramVerifyResultSchema = z
  .object({
    bot: z
      .object({
        id: z.number(),
        username: z.string().nullable(),
        name: z.string().nullable(),
      })
      .nullable(),
    chat: z
      .object({
        id: z.number(),
        title: z.string().nullable(),
        username: z.string().nullable(),
        isForum: z.boolean().nullable().openapi({
          description:
            "True when the chat is a forum group; a topic id is then required to route into a topic.",
        }),
      })
      .nullable(),
  })
  .openapi("TelegramVerifyResult");

export const telegramTopicsResponseSchema = z
  .object({
    topics: z.array(
      z.object({
        id: z.number().openapi({ description: "Forum topic (thread) id." }),
        title: z.string().openapi({
          description:
            "Topic title when it was announced in the chat, otherwise a placeholder.",
        }),
      }),
    ),
  })
  .openapi("TelegramTopics", {
    description:
      "Forum topics detected through the bot's recent updates. The Bot API cannot list topics: send a message inside a topic while polling to detect it.",
  });

export const deletedSchema = z.object({
  success: z.boolean(),
});
