import { getApiUrl } from "@/fetchers/get-api-url";
import type { TelegramConfig } from "@/types/telegram-config";

async function getTelegramConfig() {
  const response = await fetch(getApiUrl("/telegram-config"), {
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  return (data ?? { bots: [] }) as TelegramConfig;
}

export default getTelegramConfig;
