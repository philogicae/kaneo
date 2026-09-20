import { describe, expect, it } from "vitest";
import { McpSessionStore } from "../../apps/api/src/mcp/sessions";

describe("McpSessionStore", () => {
  it("returns a stored session for its owner and refreshes the TTL", () => {
    const store = new McpSessionStore<string>(1_000);
    store.set("s1", "u1", "transport", 0);

    expect(store.get("s1", "u1", 500)).toBe("transport");
    // Refreshed at 500, still alive past the original 1s deadline.
    expect(store.get("s1", "u1", 1_400)).toBe("transport");
  });

  it("drops a session idle past the TTL", () => {
    const store = new McpSessionStore<string>(1_000);
    store.set("s1", "u1", "transport", 0);

    expect(store.get("s1", "u1", 1_001)).toBeNull();
    expect(store.size).toBe(0);
  });

  it("hides a session from another user without refreshing it", () => {
    const store = new McpSessionStore<string>(1_000);
    store.set("s1", "u1", "transport", 0);

    expect(store.get("s1", "u2", 100)).toBeNull();
    expect(store.get("s1", "u1", 900)).toBe("transport");
  });

  it("sweeps only expired sessions", () => {
    const store = new McpSessionStore<string>(1_000);
    store.set("old", "u1", "a", 0);
    store.set("fresh", "u1", "b", 900);

    expect(store.sweep(1_500)).toBe(1);
    expect(store.size).toBe(1);
    expect(store.get("fresh", "u1", 1_500)).toBe("b");
  });

  it("deletes on demand (transport close)", () => {
    const store = new McpSessionStore<string>(1_000);
    store.set("s1", "u1", "a", 0);

    store.delete("s1");

    expect(store.size).toBe(0);
  });
});
