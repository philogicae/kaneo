import type {
  TelegramApiFailure,
  TelegramChatMember,
} from "../plugins/telegram/client";

export type TelegramVerifyMethod =
  | "getMe"
  | "getChat"
  | "getChatMember"
  | "getUpdates";

// Telegram's raw descriptions ("Unauthorized", "Bad Request: chat not
// found") are meaningless to end users; these are the failure modes the
// settings surface can actually act on.
export function describeTelegramFailure(
  failure: Pick<TelegramApiFailure, "error" | "errorCode">,
  method: TelegramVerifyMethod,
): string {
  const { error, errorCode } = failure;
  const description = error ?? "";

  switch (method) {
    case "getMe": {
      if (errorCode === 401 || errorCode === 404) {
        return "The bot token is invalid or has been revoked. Create a new token with @BotFather and try again.";
      }
      return `Telegram could not validate the bot: ${description}`;
    }
    case "getChat": {
      if (description.includes("chat not found")) {
        return "Chat not found: check the chat ID, and make sure the bot can access it (add it to the group or channel, or send it a message first).";
      }
      if (errorCode === 403) {
        return "The bot cannot access this chat: add it to the chat as a member or administrator, then verify again.";
      }
      return `Telegram could not look up this chat: ${description}`;
    }
    case "getChatMember": {
      if (description.includes("chat not found")) {
        return "Chat not found: check the chat ID, and make sure the bot can access it (add it to the group or channel, or send it a message first).";
      }
      if (errorCode === 403) {
        return "The bot cannot access this chat: add it to the chat as a member or administrator, then verify again.";
      }
      return `Telegram could not check the bot's membership: ${description}`;
    }
    case "getUpdates": {
      if (errorCode === 409) {
        return "Topic auto-discovery is unavailable: another process (a webhook or another polling consumer) is using this bot. Enter the topic ID manually instead.";
      }
      if (errorCode === 401 || errorCode === 404) {
        return "The bot token is invalid or has been revoked, so topics cannot be detected. Fix the bot token first, or enter the topic ID manually.";
      }
      return `Topics could not be detected: ${description}`;
    }
  }
}

export type ChatMembershipEvaluation =
  | { ok: true; status: TelegramChatMember["status"]; canPost: boolean }
  | { ok: false; message: string };

// Notifications are posted through sendMessage, so the membership check asks
// one question: can this bot post here?
// - private chats / groups / supergroups: member, administrator or creator.
// - channels: only administrators with the "Post messages" right can post;
//   a plain subscriber ("member") cannot.
// - restricted members: Telegram keeps the entry while muting the bot, so the
//   send right decides.
export function evaluateChatMembership(input: {
  chatType?: string | null;
  member: TelegramChatMember;
}): ChatMembershipEvaluation {
  const { chatType, member } = input;
  const isChannel = chatType === "channel";

  switch (member.status) {
    case "creator":
      return { ok: true, status: member.status, canPost: true };
    case "administrator": {
      const canPost = isChannel ? member.can_post_messages !== false : true;
      return canPost
        ? { ok: true, status: member.status, canPost: true }
        : {
            ok: false,
            message:
              "The bot is an administrator of this channel but cannot post in it: grant it the 'Post messages' permission, then verify again.",
          };
    }
    case "restricted": {
      if (member.is_member === false) {
        return notMember();
      }
      if (member.can_send_messages === false) {
        return {
          ok: false,
          message:
            "The bot is restricted in this chat and cannot send messages: grant it the 'Send messages' permission, then verify again.",
        };
      }
      return { ok: true, status: member.status, canPost: true };
    }
    case "member": {
      if (isChannel) {
        return {
          ok: false,
          message:
            "The bot can read this channel but cannot post in it: make it an administrator with the 'Post messages' permission, then verify again.",
        };
      }
      return { ok: true, status: member.status, canPost: true };
    }
    case "kicked":
      return {
        ok: false,
        message:
          "The bot was removed from this chat: add it back as a member or administrator, then verify again.",
      };
    case "left":
      return notMember();
  }
}

function notMember(): ChatMembershipEvaluation {
  return {
    ok: false,
    message:
      "The bot is not a member of this chat: add it to the chat (and make it an administrator for channels), then verify again.",
  };
}
