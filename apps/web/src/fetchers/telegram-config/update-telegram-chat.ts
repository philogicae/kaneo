import { getApiUrl } from "@/fetchers/get-api-url";

export type UpdateTelegramChatRequest = {
  telegramChatId: string;
  chatId?: string;
  label?: string | null;
};

async function updateTelegramChat({
  telegramChatId,
  ...body
}: UpdateTelegramChatRequest) {
  const response = await fetch(
    getApiUrl(`/telegram-config/telegram-chat/${telegramChatId}`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return { success: true };
}

export default updateTelegramChat;
