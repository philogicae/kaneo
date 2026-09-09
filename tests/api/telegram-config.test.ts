import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
  normalizeTelegramConfig,
  telegramConfigSchema,
  validateTelegramConfig,
} from "../../apps/api/src/plugins/telegram/config";

const baseConfig = {
  botToken: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi",
  chatId: "-100200300",
};

describe("telegram config schema", () => {
  it("accepts the canonical bot token format", () => {
    expect(v.safeParse(telegramConfigSchema, baseConfig).success).toBe(true);
  });

  it("accepts older-but-valid bot token shapes that the strict regex rejected", () => {
    // Short bot ids (pre-8-digit era) and longer suffixes are real tokens;
    // rejecting them at dispatch time silently stopped notifications.
    const shortBotId = {
      ...baseConfig,
      botToken: "123456:abcDEFghi_JKL-mnoPQRstuVWXYZ-__9",
    };
    expect(v.safeParse(telegramConfigSchema, shortBotId).success).toBe(true);

    const longSuffix = {
      ...baseConfig,
      botToken: `9876543210:${"aB3xY9kL2mNpQrStUvWxYz0123456789abc"}`,
    };
    expect(v.safeParse(telegramConfigSchema, longSuffix).success).toBe(true);
  });

  it("still rejects malformed tokens", () => {
    expect(
      v.safeParse(telegramConfigSchema, {
        ...baseConfig,
        botToken: "not-a-token",
      }).success,
    ).toBe(false);
    expect(
      v.safeParse(telegramConfigSchema, {
        ...baseConfig,
        botToken: "12345:short",
      }).success,
    ).toBe(false);
    expect(
      v.safeParse(telegramConfigSchema, { ...baseConfig, chatId: "" }).success,
    ).toBe(false);
  });

  it("tolerates null optional fields stored by older versions", () => {
    const parsed = v.safeParse(telegramConfigSchema, {
      ...baseConfig,
      threadId: null,
      chatLabel: null,
      events: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects out-of-range thread ids", () => {
    expect(
      v.safeParse(telegramConfigSchema, { ...baseConfig, threadId: 0 }).success,
    ).toBe(false);
    expect(
      v.safeParse(telegramConfigSchema, { ...baseConfig, threadId: 1.5 })
        .success,
    ).toBe(false);
  });

  it("applies the documented event defaults", () => {
    const normalized = normalizeTelegramConfig(
      v.parse(telegramConfigSchema, baseConfig),
    );
    expect(normalized.events).toEqual({
      taskCreated: true,
      taskStatusChanged: true,
      taskPriorityChanged: false,
      taskTitleChanged: false,
      taskDescriptionChanged: false,
      taskCommentCreated: true,
    });
    expect(normalized.threadId).toBeUndefined();
  });

  it("keeps validation green end-to-end for a legacy-shaped config", () => {
    const legacy = {
      ...baseConfig,
      botToken: "123456:abcDEFghi_JKL-mnoPQRstuVWXYZ-__9",
      threadId: null,
      chatLabel: null,
      events: null,
    };
    expect(validateTelegramConfig(legacy).valid).toBe(true);
  });
});
