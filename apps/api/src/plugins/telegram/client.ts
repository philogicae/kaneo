import * as Sentry from "@sentry/node";

type TelegramMessage = {
  chat_id: string;
  text: string;
  parse_mode?: "HTML";
  // link_preview_options supersedes the deprecated
  // disable_web_page_preview flag; notifications stay compact with no image
  // preview.
  link_preview_options?: { is_disabled: boolean };
  message_thread_id?: number;
};

const TELEGRAM_TIMEOUT_MS = 10_000;

export async function postToTelegram(
  botToken: string,
  message: TelegramMessage,
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);

  try {
    Sentry.addBreadcrumb({
      category: "integration",
      level: "info",
      data: { integration: "telegram" },
    });
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Telegram request failed (${response.status}): ${errorText}`,
      );
    }

    const result = (await response.json()) as {
      ok?: boolean;
      description?: string;
    };

    if (!result.ok) {
      throw new Error(result.description || "Telegram API request failed");
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Telegram request timed out after ${TELEGRAM_TIMEOUT_MS}ms`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

type TelegramApiCall<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

async function callTelegramApi<T>(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );

    const result = (await response
      .json()
      .catch(() => null)) as TelegramApiCall<T> | null;

    if (!response.ok || !result?.ok || result.result === undefined) {
      return {
        ok: false,
        error: result?.description || `Telegram ${method} failed`,
      };
    }

    return { ok: true, result: result.result };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: `Telegram ${method} timed out` };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export type TelegramBotInfo = {
  id: number;
  username?: string;
  first_name?: string;
};

export type TelegramChatInfo = {
  id: number;
  title?: string;
  username?: string;
  type?: string;
  is_forum?: boolean;
};

export async function getTelegramMe(
  botToken: string,
): Promise<{ ok: true; bot: TelegramBotInfo } | { ok: false; error: string }> {
  const result = await callTelegramApi<TelegramBotInfo>(botToken, "getMe", {});
  if (!result.ok) return result;
  return { ok: true, bot: result.result };
}

export async function getTelegramChat(
  botToken: string,
  chatId: string,
): Promise<
  { ok: true; chat: TelegramChatInfo } | { ok: false; error: string }
> {
  const result = await callTelegramApi<TelegramChatInfo>(botToken, "getChat", {
    chat_id: chatId,
  });
  if (!result.ok) return result;
  return { ok: true, chat: result.result };
}

export type TelegramUpdate = {
  update_id?: number;
  message?: {
    chat?: { id?: number };
    message_thread_id?: number;
    forum_topic_created?: { title?: string };
  };
  edited_message?: TelegramUpdate["message"];
};

// The Bot API cannot list forum topics directly; getUpdates is the supported
// read path. Unconfirmed updates stay queued, so repeated short polls while a
// dialog is open surface any topic the user posts into (also reports the
// webhook error, since getUpdates is forbidden while a webhook is set).
export async function getTelegramUpdates(
  botToken: string,
): Promise<
  { ok: true; updates: TelegramUpdate[] } | { ok: false; error: string }
> {
  const result = await callTelegramApi<TelegramUpdate[]>(
    botToken,
    "getUpdates",
    {
      // Exclude noisy update types the parser ignores; message covers topics.
      allowed_updates: ["message", "edited_message"],
    },
  );
  if (!result.ok) return result;
  return { ok: true, updates: result.result ?? [] };
}
