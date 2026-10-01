// In-memory legacy MCP sessions with an idle TTL.
//
// The first legacy initialize request creates a session whose transport lives
// in a map so follow-up requests can reuse it. A transport only leaves on
// close, so a client that disappears without closing would pin memory
// forever; every access refreshes `lastUsedAt`, and an entry idle past the
// TTL is dropped and reported as missing (the client re-initializes).

export const MCP_SESSION_TTL_MS = 30 * 60 * 1000;

type SessionEntry<T> = {
  value: T;
  userId: string;
  lastUsedAt: number;
};

export class McpSessionStore<T> {
  private readonly sessions = new Map<string, SessionEntry<T>>();

  constructor(private readonly ttlMs: number = MCP_SESSION_TTL_MS) {}

  /**
   * Look a session up for its owner. Returns null when it is unknown, idle
   * past the TTL, or owned by someone else - a mismatched owner is reported
   * as missing so the response cannot confirm that another user's session id
   * is valid.
   */
  get(sessionId: string, userId: string, now = Date.now()): T | null {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      return null;
    }
    if (now - entry.lastUsedAt > this.ttlMs) {
      this.sessions.delete(sessionId);
      return null;
    }
    if (entry.userId !== userId) {
      return null;
    }
    entry.lastUsedAt = now;
    return entry.value;
  }

  set(sessionId: string, userId: string, value: T, now = Date.now()): void {
    this.sessions.set(sessionId, { value, userId, lastUsedAt: now });
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /** Drop every session idle past the TTL; returns how many were removed. */
  sweep(now = Date.now()): number {
    let removed = 0;
    for (const [id, entry] of this.sessions) {
      if (now - entry.lastUsedAt > this.ttlMs) {
        this.sessions.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  get size(): number {
    return this.sessions.size;
  }
}
