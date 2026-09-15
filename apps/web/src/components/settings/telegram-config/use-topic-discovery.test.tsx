import { renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TelegramConfigChat } from "@/types/telegram-config";
import { useTopicDiscovery } from "./telegram-config-card";

const verifyChat = vi.hoisted(() => vi.fn());
const discoverTopics = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/mutations/telegram-config/use-telegram-config", () => ({
  useVerifyTelegramConfig: () => ({ mutateAsync: verifyChat }),
  useDiscoverTelegramTopics: () => ({ mutateAsync: discoverTopics }),
}));

function chatFixture(
  configId: string,
  telegramChatId = "-1001234567890",
): TelegramConfigChat {
  return {
    id: configId,
    botId: "bot-1",
    chatId: telegramChatId,
    label: "Chat",
    createdAt: "2026-09-15T00:00:00.000Z",
    updatedAt: "2026-09-15T00:00:00.000Z",
    rules: [],
  };
}

describe("useTopicDiscovery", () => {
  beforeEach(() => {
    verifyChat.mockReset().mockResolvedValue({ chat: { isForum: true } });
    discoverTopics.mockReset().mockResolvedValue({ topics: [] });
  });

  it("verifies a chat once per mount (StrictMode), not per mutation state change", async () => {
    const { rerender } = renderHook(({ chat }) => useTopicDiscovery(chat), {
      initialProps: { chat: chatFixture("config-1") },
      // StrictMode reproduces the dev double-mount; the previously shipped
      // code keyed the effect on the useMutation result object, whose
      // identity changes with every mutation state change, turning each
      // completion into a new request (unbounded loop on prod).
      wrapper: StrictMode,
    });

    // Double-mount: one run per mount, then stable deps end the sequence.
    await waitFor(() => {
      expect(verifyChat).toHaveBeenCalledTimes(2);
    });

    // Re-renders with a fresh chat object identity (same config id) must
    // not re-verify.
    rerender({ chat: { ...chatFixture("config-1"), label: "Renamed" } });
    rerender({ chat: chatFixture("config-1") });

    expect(verifyChat).toHaveBeenCalledTimes(2);
    expect(discoverTopics).toHaveBeenCalled();
  });

  it("re-verifies only when the config chat id changes", async () => {
    const { rerender } = renderHook(({ chat }) => useTopicDiscovery(chat), {
      initialProps: { chat: chatFixture("config-1") },
    });

    await waitFor(() => {
      expect(verifyChat).toHaveBeenCalledTimes(1);
    });

    rerender({ chat: chatFixture("config-2") });

    await waitFor(() => {
      expect(verifyChat).toHaveBeenCalledTimes(2);
    });
  });

  it("stops topic discovery after repeated failures instead of polling forever", async () => {
    vi.useFakeTimers();
    try {
      discoverTopics.mockRejectedValue(new Error("409"));
      renderHook(() => useTopicDiscovery(chatFixture("config-3")));

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(3000 * 5);

      // Initial attempt + one per 3s interval, capped at 5 failures.
      expect(discoverTopics).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
  });
});
