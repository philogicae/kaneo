import { getApiUrl } from "@/fetchers/get-api-url";
import type { TelegramConfigBot } from "@/types/telegram-config";

export type CreateTelegramBotRequest = {
  botToken: string;
  name?: string;
};

async function createTelegramBot({ botToken, name }: CreateTelegramBotRequest) {
  const response = await fetch(getApiUrl("/telegram-config/bot"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ botToken, ...(name ? { name } : {}) }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as TelegramConfigBot;
}

export default createTelegramBot;
