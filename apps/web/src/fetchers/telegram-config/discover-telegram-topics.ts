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

  return (await response.json()) as { topics: TelegramTopic[] };
}

export default discoverTelegramTopics;
