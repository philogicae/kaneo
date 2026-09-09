import * as v from "valibot";

export const telegramEventKeys = [
  "taskCreated",
  "taskStatusChanged",
  "taskPriorityChanged",
  "taskTitleChanged",
  "taskDescriptionChanged",
  "taskCommentCreated",
] as const;

export type TelegramEventKey = (typeof telegramEventKeys)[number];

export const telegramEventsSchema = v.object(
  Object.fromEntries(
    telegramEventKeys.map((key) => [key, v.optional(v.boolean())]),
  ) as Record<
    TelegramEventKey,
    v.OptionalSchema<v.BooleanSchema<undefined>, never>
  >,
);

const telegramBotTokenSchema = v.pipe(
  v.string(),
  v.trim(),
  // Real tokens are "<bot id>:<random suffix>" where the bot id predates the
  // 8-digit era and the suffix length varies; the previous strict
  // 8-10 digits + exactly 35 chars silently rejected older-but-valid
  // integrations at dispatch time, stopping all notifications.
  v.regex(/^\d{1,10}:[A-Za-z0-9_-]{30,}$/, "Enter a valid Telegram bot token"),
);

const telegramChatIdSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, "Chat ID is required"),
);

export const telegramConfigSchema = v.object({
  botToken: telegramBotTokenSchema,
  chatId: telegramChatIdSchema,
  // Older stored configs may carry null for the optional fields.
  threadId: v.nullish(v.pipe(v.number(), v.integer(), v.minValue(1))),
  chatLabel: v.nullish(v.string()),
  events: v.nullish(telegramEventsSchema),
});

export type TelegramConfig = v.InferOutput<typeof telegramConfigSchema>;

export type NormalizedTelegramConfig = {
  botToken: string;
  chatId: string;
  threadId?: number;
  chatLabel?: string;
  events: Record<TelegramEventKey, boolean>;
};

export const defaultTelegramEvents: Record<TelegramEventKey, boolean> = {
  taskCreated: true,
  taskStatusChanged: true,
  taskPriorityChanged: false,
  taskTitleChanged: false,
  taskDescriptionChanged: false,
  taskCommentCreated: true,
};

export function normalizeTelegramConfig(
  config: TelegramConfig,
): NormalizedTelegramConfig {
  return {
    botToken: config.botToken,
    chatId: config.chatId,
    threadId:
      typeof config.threadId === "number" && Number.isFinite(config.threadId)
        ? config.threadId
        : undefined,
    chatLabel: config.chatLabel?.trim() || undefined,
    events: {
      ...defaultTelegramEvents,
      ...(config.events ?? {}),
    },
  };
}

export function validateTelegramConfig(config: unknown): {
  valid: boolean;
  errors?: string[];
} {
  try {
    const parsed = v.parse(telegramConfigSchema, config);
    normalizeTelegramConfig(parsed);
    return { valid: true };
  } catch (error) {
    if (error instanceof v.ValiError) {
      return {
        valid: false,
        errors: error.issues.map((issue) => issue.message),
      };
    }

    return {
      valid: false,
      errors: [error instanceof Error ? error.message : "Invalid config"],
    };
  }
}
