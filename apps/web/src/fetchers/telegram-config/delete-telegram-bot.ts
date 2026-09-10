import { getApiUrl } from "@/fetchers/get-api-url";

async function deleteTelegramBot(botId: string) {
  const response = await fetch(getApiUrl(`/telegram-config/bot/${botId}`), {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return { success: true };
}

export default deleteTelegramBot;
