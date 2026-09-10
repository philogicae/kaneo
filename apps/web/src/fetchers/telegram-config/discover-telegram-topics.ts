import { getApiUrl } from "@/fetchers/get-api-url";
import type { TelegramTopic } from "@/types/telegram-config";

// Reads the bot's recent updates and returns the forum topics seen in this
// chat. Poll it while the rule dialog is open: sending a message inside a
// topic makes it appear.
async function discoverTelegramTopics(telegramChatId: string) {
  const response = await fetch(
    getApiUrl(`/telegram-config/telegram-chat/${telegramChatId}/topics`),
    {
      method: "POST",
      credentials: "include",
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as { topics: TelegramTopic[] };
}

export default discoverTelegramTopics;
