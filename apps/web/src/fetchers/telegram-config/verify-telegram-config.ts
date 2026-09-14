import { getApiUrl } from "@/fetchers/get-api-url";
import type { TelegramVerifyResult } from "@/types/telegram-config";

export type VerifyTelegramRequest = {
  botToken?: string;
  botId?: string;
  chatId?: string;
  telegramChatId?: string;
};

async function verifyTelegramConfig(body: VerifyTelegramRequest) {
  const response = await fetch(getApiUrl("/telegram-config/verify"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    // Validation failures can come back as JSON error bodies; prefer their
    // message over the raw JSON dump.
    let message = error;
    try {
      const parsed = JSON.parse(error) as { message?: unknown };
      if (typeof parsed.message === "string") {
        message = parsed.message;
      }
    } catch {
      // Plain-text error body: already the message.
    }
    throw new Error(message);
  }

  return (await response.json()) as TelegramVerifyResult;
}

export default verifyTelegramConfig;
