import { getApiUrl } from "@/fetchers/get-api-url";
import type { TelegramConfigRule } from "@/types/telegram-config";

export type UpdateTelegramRuleRequest = {
  telegramRuleId: string;
  projectIds?: string[] | null;
  threadId?: number | null;
  isActive?: boolean;
};

async function updateTelegramRule({
  telegramRuleId,
  ...body
}: UpdateTelegramRuleRequest) {
  const response = await fetch(
    getApiUrl(`/telegram-config/telegram-rule/${telegramRuleId}`),
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

  return (await response.json()) as TelegramConfigRule[];
}

export default updateTelegramRule;
