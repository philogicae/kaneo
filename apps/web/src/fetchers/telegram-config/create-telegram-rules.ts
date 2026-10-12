import { getApiUrl } from "@/fetchers/get-api-url";
import type { TelegramRuleScope } from "@/types/telegram-config";

export type CreateTelegramRulesRequest = {
  telegramChatId: string;
  scopes: TelegramRuleScope[];
  threadId?: number | null;
};

async function createTelegramRules({
  telegramChatId,
  scopes,
  threadId,
}: CreateTelegramRulesRequest) {
  const response = await fetch(
    getApiUrl(`/telegram-config/telegram-chat/${telegramChatId}/rules`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ scopes, threadId: threadId ?? null }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as unknown[];
}

export default createTelegramRules;
