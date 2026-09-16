import { describe, expect, it } from "vitest";
import { normalizeDiscordConfig } from "../../../apps/api/src/plugins/discord/config";
import { normalizeSlackConfig } from "../../../apps/api/src/plugins/slack/config";
import {
  defaultTelegramEvents,
  normalizeTelegramConfig,
} from "../../../apps/api/src/plugins/telegram/config";

const discordWebhook =
  "https://discord.com/api/webhooks/123456789012345678/token-abc";
const slackWebhook =
  "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX";

// Comments and mentions are separate subscriptions: mentioning someone must
// notify even when a channel only wants mentions (and vice versa), so both
// default to on.
describe("mention event defaults", () => {
  it("enables comments and mentions for Discord", () => {
    const config = normalizeDiscordConfig({ webhookUrl: discordWebhook });
    expect(config.events?.taskCommentCreated).toBe(true);
    expect(config.events?.taskMentionCreated).toBe(true);
  });

  it("keeps an explicit Discord mention opt-out", () => {
    const config = normalizeDiscordConfig({
      webhookUrl: discordWebhook,
      events: { taskMentionCreated: false },
    });
    expect(config.events?.taskMentionCreated).toBe(false);
    expect(config.events?.taskCommentCreated).toBe(true);
  });

  it("enables comments and mentions for Slack", () => {
    const config = normalizeSlackConfig({ webhookUrl: slackWebhook });
    expect(config.events?.taskCommentCreated).toBe(true);
    expect(config.events?.taskMentionCreated).toBe(true);
  });

  it("keeps an explicit Slack mention opt-out", () => {
    const config = normalizeSlackConfig({
      webhookUrl: slackWebhook,
      events: { taskMentionCreated: false },
    });
    expect(config.events?.taskMentionCreated).toBe(false);
    expect(config.events?.taskCommentCreated).toBe(true);
  });

  it("enables comments and mentions for Telegram", () => {
    expect(defaultTelegramEvents.taskCommentCreated).toBe(true);
    expect(defaultTelegramEvents.taskMentionCreated).toBe(true);

    const config = normalizeTelegramConfig({
      botToken: "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi",
      chatId: "-100200300",
    });
    expect(config.events.taskCommentCreated).toBe(true);
    expect(config.events.taskMentionCreated).toBe(true);
  });
});
