import { describe, expect, it } from "vitest";
import {
  describeTelegramFailure,
  evaluateChatMembership,
} from "../../apps/api/src/telegram-config/verify";

describe("describeTelegramFailure", () => {
  it("explains an invalid or revoked token", () => {
    const message = describeTelegramFailure(
      { error: "Unauthorized", errorCode: 401 },
      "getMe",
    );
    expect(message).toContain("invalid or has been revoked");
    expect(message).toContain("@BotFather");
  });

  it("falls back to the raw description for unmapped getMe failures", () => {
    const message = describeTelegramFailure(
      { error: "Too Many Requests: retry after 3", errorCode: 429 },
      "getMe",
    );
    expect(message).toContain("Too Many Requests");
  });

  it("turns 'chat not found' into an actionable message", () => {
    const message = describeTelegramFailure(
      { error: "Bad Request: chat not found", errorCode: 400 },
      "getChat",
    );
    expect(message).toContain("Chat not found");
    expect(message).toContain("add it to the group or channel");
  });

  it("maps a 403 chat lookup to the bot-access hint", () => {
    const message = describeTelegramFailure(
      {
        error: "Forbidden: bot is not a member of the group chat",
        errorCode: 403,
      },
      "getChat",
    );
    expect(message).toContain("cannot access this chat");
  });

  it("explains the getUpdates webhook conflict (409)", () => {
    const message = describeTelegramFailure(
      {
        error:
          "Conflict: can't use getUpdates method while webhook for active webhook is set",
        errorCode: 409,
      },
      "getUpdates",
    );
    expect(message).toContain("Topic auto-discovery is unavailable");
    expect(message).toContain("Enter the topic ID manually");
  });

  it("explains an invalid token during topic detection", () => {
    const message = describeTelegramFailure(
      { error: "Unauthorized", errorCode: 401 },
      "getUpdates",
    );
    expect(message).toContain("topic ID manually");
  });
});

describe("evaluateChatMembership", () => {
  it("accepts the creator and group administrators", () => {
    expect(
      evaluateChatMembership({
        chatType: "supergroup",
        member: { status: "creator" },
      }),
    ).toMatchObject({ ok: true, canPost: true });
    expect(
      evaluateChatMembership({
        chatType: "group",
        member: { status: "administrator" },
      }),
    ).toMatchObject({ ok: true, canPost: true });
  });

  it("accepts channel administrators only when they can post", () => {
    expect(
      evaluateChatMembership({
        chatType: "channel",
        member: { status: "administrator", can_post_messages: true },
      }),
    ).toMatchObject({ ok: true });
    const denied = evaluateChatMembership({
      chatType: "channel",
      member: { status: "administrator", can_post_messages: false },
    });
    expect(denied).toMatchObject({ ok: false });
    if (!denied.ok) {
      expect(denied.message).toContain("Post messages");
    }
  });

  it("rejects plain subscribers of channels", () => {
    const denied = evaluateChatMembership({
      chatType: "channel",
      member: { status: "member" },
    });
    expect(denied).toMatchObject({ ok: false });
    if (!denied.ok) {
      expect(denied.message).toContain("cannot post in it");
    }
  });

  it("accepts plain members of groups and private chats", () => {
    expect(
      evaluateChatMembership({
        chatType: "supergroup",
        member: { status: "member" },
      }),
    ).toMatchObject({ ok: true });
    expect(
      evaluateChatMembership({
        chatType: "private",
        member: { status: "member" },
      }),
    ).toMatchObject({ ok: true });
  });

  it("rejects restricted members without the send right", () => {
    const denied = evaluateChatMembership({
      chatType: "supergroup",
      member: {
        status: "restricted",
        is_member: true,
        can_send_messages: false,
      },
    });
    expect(denied).toMatchObject({ ok: false });
    if (!denied.ok) {
      expect(denied.message).toContain("restricted");
    }
  });

  it("treats a restricted entry with is_member false as absent", () => {
    const denied = evaluateChatMembership({
      chatType: "supergroup",
      member: { status: "restricted", is_member: false },
    });
    expect(denied).toMatchObject({ ok: false });
    if (!denied.ok) {
      expect(denied.message).toContain("not a member");
    }
  });

  it("rejects left and kicked bots with targeted advice", () => {
    const left = evaluateChatMembership({
      chatType: "group",
      member: { status: "left" },
    });
    expect(left).toMatchObject({ ok: false });
    if (!left.ok) {
      expect(left.message).toContain("not a member");
    }

    const kicked = evaluateChatMembership({
      chatType: "group",
      member: { status: "kicked" },
    });
    expect(kicked).toMatchObject({ ok: false });
    if (!kicked.ok) {
      expect(kicked.message).toContain("removed from this chat");
    }
  });
});
