import { z } from "../openapi";

export const botIdParam = z.object({
  botId: z.string(),
});

export const telegramChatIdParam = z.object({
  telegramChatId: z.string(),
});

export const telegramRuleIdParam = z.object({
  telegramRuleId: z.string(),
});

export const createTelegramBotBody = z.object({
  botToken: z.string().min(1).openapi({
    description: "A Telegram bot token, in the form 123456789:AA...",
  }),
  name: z.string().optional(),
});

export const updateTelegramBotBody = z.object({
  botToken: z.string().optional(),
  name: z.string().nullable().optional(),
  events: z
    .object({
      taskCreated: z.boolean().optional(),
      taskStatusChanged: z.boolean().optional(),
      taskPriorityChanged: z.boolean().optional(),
      taskTitleChanged: z.boolean().optional(),
      taskDescriptionChanged: z.boolean().optional(),
      taskCommentCreated: z.boolean().optional(),
    })
    .optional()
    .openapi({
      description:
        "Per-bot event filter; omitted keys keep the plugin default (created and comments on).",
    }),
});

export const createTelegramChatBody = z.object({
  chatId: z.string().min(1).openapi({
    description:
      "The Telegram chat, group, or channel id (e.g. -1001234567890).",
  }),
  label: z.string().optional(),
});

export const updateTelegramChatBody = z.object({
  chatId: z.string().optional(),
  label: z.string().nullable().optional(),
});

export const telegramRuleScope = z.object({
  workspaceId: z.string(),
  projectIds: z.array(z.string()).nullable().openapi({
    description:
      "Restrict the rule to these projects of the workspace; null routes every project.",
  }),
});

export const createTelegramRulesBody = z.object({
  scopes: z.array(telegramRuleScope).min(1).openapi({
    description:
      "One entry per selected workspace; several workspaces create several rules.",
  }),
  threadId: z.number().int().min(1).nullable().openapi({
    description:
      "Forum topic id. The Bot API cannot list topics, so this is entered manually.",
  }),
});

export const updateTelegramRuleBody = z.object({
  projectIds: z.array(z.string()).nullable().optional(),
  threadId: z.number().int().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const verifyTelegramBody = z.object({
  botToken: z.string().optional().openapi({
    description: "Raw token to verify before saving.",
  }),
  botId: z.string().optional().openapi({
    description: "Stored bot to verify (token resolved server-side).",
  }),
  chatId: z.string().optional(),
  telegramChatId: z.string().optional().openapi({
    description:
      "Stored chat row to verify (chat id + token resolved server-side).",
  }),
});
