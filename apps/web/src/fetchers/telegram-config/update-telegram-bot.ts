import { getApiUrl } from "@/fetchers/get-api-url";
import type { TelegramConfigBot } from "@/types/telegram-config";

export type UpdateTelegramBotRequest = {
  botId: string;
  botToken?: string;
  name?: string | null;
  events?: Partial<TelegramConfigBot["events"]>;
};

async function updateTelegramBot({ botId, ...body }: UpdateTelegramBotRequest) {
  const response = await fetch(getApiUrl(`/telegram-config/bot/${botId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as TelegramConfigBot;
}

export default updateTelegramBot;
