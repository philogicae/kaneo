import { mentionIntegrationEventToggles } from "../integrations/schema";
import { z } from "../openapi";

export const createDiscordBody = z.object({
  webhookUrl: z.string().min(1),
  channelName: z.string().optional(),
  events: mentionIntegrationEventToggles.optional(),
});

export const updateDiscordBody = z.object({
  webhookUrl: z.string().optional(),
  channelName: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  events: mentionIntegrationEventToggles.optional(),
});
