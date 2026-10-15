import { getApiUrl } from "@/fetchers/get-api-url";

async function deleteTelegramChat(telegramChatId: string) {
  const response = await fetch(
    getApiUrl(`/telegram-config/telegram-chat/${telegramChatId}`),
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return { success: true };
}

export default deleteTelegramChat;
