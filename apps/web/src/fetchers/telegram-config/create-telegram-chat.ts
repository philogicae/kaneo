import { getApiUrl } from "@/fetchers/get-api-url";
import type { TelegramConfigChat } from "@/types/telegram-config";

export type CreateTelegramChatRequest = {
  botId: string;
  chatId: string;
  label?: string;
};

async function createTelegramChat({
  botId,
  chatId,
  label,
}: CreateTelegramChatRequest) {
  const response = await fetch(
    getApiUrl(`/telegram-config/bot/${botId}/chat`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ chatId, ...(label ? { label } : {}) }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as TelegramConfigChat;
}

export default createTelegramChat;
