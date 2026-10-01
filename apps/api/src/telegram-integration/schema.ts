import { mentionIntegrationEventToggles } from "../integrations/schema";
import { z } from "../openapi";

export const createTelegramBody = z.object({
  botToken: z.string().min(1).openapi({
    description: "A Telegram bot token, in the form 123456789:AA...",
  }),
  chatId: z.string().min(1),
  threadId: z.number().optional(),
  chatLabel: z.string().optional(),
  events: mentionIntegrationEventToggles.optional(),
});

// Must match TelegramIntegrationPatchBody in controllers/telegram-controller.
export const updateTelegramBody = z.object({
  botToken: z.string().optional(),
  chatId: z.string().optional(),
  threadId: z.number().nullable().optional(),
  chatLabel: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  events: mentionIntegrationEventToggles.optional(),
});
