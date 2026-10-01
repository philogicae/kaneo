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
  error_code?: number;
};

// Telegram reports errors both as its own error_code (e.g. 401 for a bad
// token, 409 while a webhook owns getUpdates) and as an HTTP status; callers
// map them to user-facing messages, so both are surfaced.
export type TelegramApiFailure = {
  ok: false;
  error: string;
  errorCode?: number;
};

type TelegramApiSuccess<T> = { ok: true; result: T };

async function callTelegramApi<T>(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<TelegramApiSuccess<T> | TelegramApiFailure> {
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
        errorCode: result?.error_code ?? response.status,
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
  // False when the bot's privacy settings forbid being added to groups;
  // group/channel notifications then cannot work.
  can_join_groups?: boolean;
  // False under privacy mode: the bot only sees commands in groups. Posting
  // notifications still works, but topic detection through getUpdates is
  // limited to messages the bot receives.
  can_read_all_group_messages?: boolean;
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
): Promise<{ ok: true; bot: TelegramBotInfo } | TelegramApiFailure> {
  const result = await callTelegramApi<TelegramBotInfo>(botToken, "getMe", {});
  if (!result.ok) return result;
  return { ok: true, bot: result.result };
}

export async function getTelegramChat(
  botToken: string,
  chatId: string,
): Promise<{ ok: true; chat: TelegramChatInfo } | TelegramApiFailure> {
  const result = await callTelegramApi<TelegramChatInfo>(botToken, "getChat", {
    chat_id: chatId,
  });
  if (!result.ok) return result;
  return { ok: true, chat: result.result };
}

export type TelegramChatMember = {
  status:
    | "creator"
    | "administrator"
    | "member"
    | "restricted"
    | "left"
    | "kicked";
  // administrator only.
  can_post_messages?: boolean;
  // restricted only; absent means unrestricted membership.
  is_member?: boolean;
  can_send_messages?: boolean;
};

// getChat alone succeeds for public channels the bot cannot post in;
// getChatMember is what proves the bot is actually in the chat with the
// rights notifications require.
export async function getTelegramChatMember(
  botToken: string,
  chatId: string,
  userId: number,
): Promise<{ ok: true; member: TelegramChatMember } | TelegramApiFailure> {
  const result = await callTelegramApi<TelegramChatMember>(
    botToken,
    "getChatMember",
    { chat_id: chatId, user_id: userId },
  );
  if (!result.ok) return result;
  return { ok: true, member: result.result };
}

export type TelegramUpdate = {
  update_id?: number;
  message?: {
    chat?: { id?: number };
    message_thread_id?: number;
    forum_topic_created?: { title?: string };
    forum_topic_edited?: { title?: string };
    // Replies inside a forum topic carry the replied-to message; when the user
    // replies to the topic root, that object exposes the creation service
    // message even if it predates the update window.
    reply_to_message?: {
      forum_topic_created?: { title?: string };
      forum_topic_edited?: { title?: string };
    };
  };
  edited_message?: TelegramUpdate["message"];
};

// The Bot API cannot list forum topics directly; getUpdates is the supported
// read path. Unconfirmed updates stay queued, so repeated short polls while a
// dialog is open surface any topic the user posts into (also reports the
// webhook error, since getUpdates is forbidden while a webhook is set).
export async function getTelegramUpdates(
  botToken: string,
): Promise<{ ok: true; updates: TelegramUpdate[] } | TelegramApiFailure> {
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
