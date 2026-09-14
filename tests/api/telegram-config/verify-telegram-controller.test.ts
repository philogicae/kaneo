import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetTelegramMe = vi.fn();
const mockGetTelegramChat = vi.fn();
const mockGetTelegramChatMember = vi.fn();
const mockGetTelegramUpdates = vi.fn();

vi.mock("../../../apps/api/src/plugins/telegram/client", () => ({
  getTelegramMe: (...args: unknown[]) => mockGetTelegramMe(...args),
  getTelegramChat: (...args: unknown[]) => mockGetTelegramChat(...args),
  getTelegramChatMember: (...args: unknown[]) =>
    mockGetTelegramChatMember(...args),
  getTelegramUpdates: (...args: unknown[]) => mockGetTelegramUpdates(...args),
}));

type OwnedRow = {
  id: string;
  userId: string;
  botToken: string;
  name: string | null;
  events: Record<string, boolean> | null;
  createdAt: Date;
  updatedAt: Date;
};

const botRow: OwnedRow = {
  id: "bot-row-1",
  userId: "user-1",
  botToken: "111111:AAAA_valid_token_shape_000000000000",
  name: null,
  events: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const chatRow = {
  id: "chat-row-1",
  botId: "bot-row-1",
  chatId: "-1001234567890",
  label: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

// The controller resolves ownership through drizzle chains; the stub flips to
// the joined shape once innerJoin is seen (requireOwnedChat).
const dbState = { joined: false };

vi.mock("../../../apps/api/src/database", () => {
  const builder = {
    from: () => builder,
    innerJoin: () => {
      dbState.joined = true;
      return builder;
    },
    where: () => builder,
    limit: () =>
      Promise.resolve([
        dbState.joined ? { chat: chatRow, bot: botRow } : botRow,
      ]),
  };
  return {
    default: {
      select: () => builder,
      query: { telegramBotTable: { findMany: async () => [] } },
      insert: () => ({ values: () => ({ returning: async () => [] }) }),
      update: () => ({
        set: () => ({ where: () => ({ returning: async () => [] }) }),
      }),
      delete: () => ({ where: () => Promise.resolve() }),
    },
  };
});

import {
  listTelegramTopics,
  verifyTelegram,
} from "../../../apps/api/src/telegram-config/controllers/telegram-config-controller";

beforeEach(() => {
  vi.clearAllMocks();
  dbState.joined = false;
});

const botInfo = {
  id: 777,
  username: "kaneo_bot",
  first_name: "Kaneo",
  can_join_groups: true,
  can_read_all_group_messages: false,
};

describe("verifyTelegram", () => {
  it("returns the bot identity and capabilities for a valid token", async () => {
    mockGetTelegramMe.mockResolvedValue({ ok: true, bot: botInfo });

    const result = await verifyTelegram({} as never, "user-1", {
      botToken: botRow.botToken,
    });

    expect(result.bot).toEqual({
      id: 777,
      username: "kaneo_bot",
      name: "Kaneo",
      canJoinGroups: true,
    });
    expect(result.chat).toBeNull();
    expect(mockGetTelegramChatMember).not.toHaveBeenCalled();
  });

  it("rejects an invalid token with an actionable message", async () => {
    mockGetTelegramMe.mockResolvedValue({
      ok: false,
      error: "Unauthorized",
      errorCode: 401,
    });

    await expect(
      verifyTelegram({} as never, "user-1", {
        botToken: "111111:AAAA_invalid",
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("invalid or has been revoked"),
    });
  });

  it("reports the bot's membership when verifying a stored chat", async () => {
    mockGetTelegramMe.mockResolvedValue({ ok: true, bot: botInfo });
    mockGetTelegramChat.mockResolvedValue({
      ok: true,
      chat: {
        id: -1001234567890,
        title: "Ops",
        is_forum: true,
        type: "supergroup",
      },
    });
    mockGetTelegramChatMember.mockResolvedValue({
      ok: true,
      member: { status: "administrator", can_post_messages: true },
    });

    const result = await verifyTelegram({} as never, "user-1", {
      telegramChatId: "chat-row-1",
    });

    expect(mockGetTelegramChatMember).toHaveBeenCalledWith(
      botRow.botToken,
      "-1001234567890",
      777,
    );
    expect(result.chat).toEqual({
      id: -1001234567890,
      title: "Ops",
      username: null,
      isForum: true,
      botMemberStatus: "administrator",
      botCanPost: true,
    });
  });

  it("fails verification when the bot is not a member of the chat", async () => {
    mockGetTelegramMe.mockResolvedValue({ ok: true, bot: botInfo });
    mockGetTelegramChat.mockResolvedValue({
      ok: true,
      chat: { id: -1001234567890, title: "Ops", type: "supergroup" },
    });
    mockGetTelegramChatMember.mockResolvedValue({
      ok: true,
      member: { status: "left" },
    });

    await expect(
      verifyTelegram({} as never, "user-1", { telegramChatId: "chat-row-1" }),
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("not a member of this chat"),
    });
  });

  it("fails verification for a channel subscriber that cannot post", async () => {
    mockGetTelegramMe.mockResolvedValue({ ok: true, bot: botInfo });
    mockGetTelegramChat.mockResolvedValue({
      ok: true,
      chat: { id: -10019988, title: "Announcements", type: "channel" },
    });
    mockGetTelegramChatMember.mockResolvedValue({
      ok: true,
      member: { status: "member" },
    });

    await expect(
      verifyTelegram({} as never, "user-1", { telegramChatId: "chat-row-1" }),
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("cannot post in it"),
    });
  });

  it("maps 'chat not found' to the actionable guidance", async () => {
    mockGetTelegramMe.mockResolvedValue({ ok: true, bot: botInfo });
    mockGetTelegramChat.mockResolvedValue({
      ok: false,
      error: "Bad Request: chat not found",
      errorCode: 400,
    });

    await expect(
      verifyTelegram({} as never, "user-1", { telegramChatId: "chat-row-1" }),
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("Chat not found"),
    });
  });
});

describe("listTelegramTopics", () => {
  it("explains the webhook conflict instead of leaking the raw 409", async () => {
    dbState.joined = false;
    mockGetTelegramUpdates.mockResolvedValue({
      ok: false,
      error: "Conflict: can't use getUpdates while a webhook is set",
      errorCode: 409,
    });

    await expect(
      listTelegramTopics("user-1", "chat-row-1"),
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("Topic auto-discovery is unavailable"),
    });
  });

  it("returns topics seen in the chat's recent updates", async () => {
    mockGetTelegramUpdates.mockResolvedValue({
      ok: true,
      updates: [
        {
          message: {
            chat: { id: -1001234567890 },
            message_thread_id: 5,
            forum_topic_created: { title: "Deployments" },
          },
        },
        {
          message: { chat: { id: -999 }, message_thread_id: 6 },
        },
      ],
    });

    const topics = await listTelegramTopics("user-1", "chat-row-1");
    expect(topics).toEqual([{ id: 5, title: "Deployments" }]);
  });

  it("prefers real titles over placeholders regardless of update order", async () => {
    // A message inside an old topic arrives before its creation event.
    mockGetTelegramUpdates.mockResolvedValue({
      ok: true,
      updates: [
        {
          message: { chat: { id: -1001234567890 }, message_thread_id: 9 },
        },
        {
          message: {
            chat: { id: -1001234567890 },
            message_thread_id: 9,
            forum_topic_created: { title: "General" },
          },
        },
      ],
    });

    const topics = await listTelegramTopics("user-1", "chat-row-1");
    expect(topics).toEqual([{ id: 9, title: "General" }]);
  });

  it("names existing topics through topic edits and replies to the root", async () => {
    mockGetTelegramUpdates.mockResolvedValue({
      ok: true,
      updates: [
        {
          message: {
            chat: { id: -1001234567890 },
            message_thread_id: 3,
            forum_topic_edited: { title: "Incidents" },
          },
        },
        {
          message: {
            chat: { id: -1001234567890 },
            message_thread_id: 7,
            reply_to_message: {
              forum_topic_created: { title: "Hotfixes" },
            },
          },
        },
        {
          // Topic never announced in the visible window: unnamed placeholder.
          message: { chat: { id: -1001234567890 }, message_thread_id: 8 },
        },
      ],
    });

    const topics = await listTelegramTopics("user-1", "chat-row-1");
    expect(topics).toEqual([
      { id: 3, title: "Incidents" },
      { id: 7, title: "Hotfixes" },
      { id: 8, title: "Topic 8" },
    ]);
  });
});
