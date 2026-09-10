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
    throw new Error(error);
  }

  return (await response.json()) as TelegramVerifyResult;
}

export default verifyTelegramConfig;
