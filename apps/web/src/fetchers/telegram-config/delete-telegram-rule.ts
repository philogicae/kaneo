import { getApiUrl } from "@/fetchers/get-api-url";

async function deleteTelegramRule(telegramRuleId: string) {
  const response = await fetch(
    getApiUrl(`/telegram-config/telegram-rule/${telegramRuleId}`),
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

export default deleteTelegramRule;
