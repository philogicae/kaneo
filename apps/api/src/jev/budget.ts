// Request-budget helpers shared by the Jev integrations.
//
// The API allows 64k tokens per request and 32k for the state plus the
// longest question; the default budget keeps a wide margin for the
// token-estimate drift. Callers truncate oversized items and run the
// budget-fitting question batches in parallel.

export const MAX_REQUEST_TOKENS = 30_000;
export const REQUEST_OVERHEAD_TOKENS = 20;

const _TOKEN_PIECES = /[A-Za-z]+|\d+|[^\sA-Za-z\d]/g;

// Tokenizer-free estimate tuned for JSON-heavy Jev states, ported from the
// reference implementation (calibrated against Jev usage): a word costs one
// token per six letters, a digit half a token, any other symbol nine tenths.
// A non-ASCII character costs two: the reference measured a batch estimated at
// 20k tokens carrying 80k real ones in CJK, and the request failed. Accented
// Latin is overcounted on purpose - an overcount only costs an extra
// concurrent request, an undercount silently drops Jev.
export function estimateJevTokens(text: string): number {
  let tokens = 0;
  for (const piece of text.match(_TOKEN_PIECES) ?? []) {
    const first = piece.charCodeAt(0);
    if (first >= 48 && first <= 57) {
      tokens += piece.length / 2;
    } else if ((first >= 65 && first <= 90) || (first >= 97 && first <= 122)) {
      tokens += 1 + Math.floor((piece.length - 1) / 6);
    } else if (first > 127) {
      tokens += 2 * piece.length;
    } else {
      tokens += 0.9;
    }
  }
  return Math.max(0, Math.ceil(tokens - 1e-9));
}

// A ratio (0-1) from an env override, clamped; falls back when unset or
// unparsable.
export function envRatio(name: string, fallback: number): number {
  const raw = Number.parseFloat(process.env[name]?.trim() ?? "");
  if (!Number.isFinite(raw)) {
    return fallback;
  }
  return Math.min(Math.max(raw, 0), 1);
}

// A boolean env override; accepts the usual on/off spellings (and 0/1) and
// falls back when unset or unrecognized.
export function envFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase() ?? "";
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") {
    return true;
  }
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") {
    return false;
  }
  return fallback;
}

export function resolvedMaxRequestTokens(value: number | undefined): number {
  if (value !== undefined) {
    return Math.max(1_000, value);
  }
  const raw = Number.parseInt(
    process.env.KANEO_JEV_MAX_REQUEST_TOKENS?.trim() ?? "",
    10,
  );
  return Number.isFinite(raw) ? Math.max(1_000, raw) : MAX_REQUEST_TOKENS;
}

// The cost every request of a pass shares: the base state and the envelope.
export function baseRequestTokens(baseState: unknown): number {
  return estimateJevTokens(JSON.stringify(baseState)) + REQUEST_OVERHEAD_TOKENS;
}

// Split items into consecutive groups that each fit the budget; the caller
// runs the groups in parallel.
export function splitByBudget<T extends { tokens: number }>(
  items: T[],
  budget: number,
): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let used = 0;
  for (const item of items) {
    if (current.length > 0 && used + item.tokens > budget) {
      batches.push(current);
      current = [];
      used = 0;
    }
    current.push(item);
    used += item.tokens;
  }
  if (current.length > 0) {
    batches.push(current);
  }
  return batches;
}
