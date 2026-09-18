// Jev (TypeSafe System One) is a typed judgment API: the caller sends a
// `state` plus a map of `questions` (`noul`, `choice`, `score`) and receives
// calibrated answers instead of prose. Every integration is opt-in and
// fail-open: without TYPESAFE_API_KEY, or on any failure, callers keep their
// previous behavior.
//
// Defaults mirror the official JavaScript SDK: 10s per attempt, two retries
// with 500ms-5s backoff and jitter, retrying 408/429/5xx and honoring
// `Retry-After`. Every knob stays overridable through env.

const DEFAULT_MODEL = "jev-latest";
const DEFAULT_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const BACKOFF_INITIAL_MS = 500;
const BACKOFF_MAX_MS = 5_000;
const BACKOFF_JITTER = 0.25;
const MAX_RETRY_AFTER_MS = 60_000;

export type JevScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: string[];
};

export type JevNoulQuestion = {
  type: "noul";
  instructions: string;
  criteria?: { true: string; false: string };
};

export type JevChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string | null>;
};

export type JevQuestion =
  | JevScoreQuestion
  | JevNoulQuestion
  | JevChoiceQuestion;

export type JevAnswers = Record<string, Record<string, unknown>>;

export type JevAsker = (
  state: unknown,
  questions: Record<string, JevQuestion>,
) => Promise<JevAnswers>;

function envInt(name: string): number | undefined {
  const raw = Number.parseInt(process.env[name]?.trim() ?? "", 10);
  return Number.isFinite(raw) ? raw : undefined;
}

export function jevApiKey() {
  return process.env.TYPESAFE_API_KEY?.trim() ?? "";
}

export function isJevEnabled() {
  return jevApiKey().length > 0;
}

function jevModel() {
  return (
    process.env.KANEO_JEV_MODEL?.trim() ||
    process.env.TYPESAFE_DEFAULT_MODEL?.trim() ||
    DEFAULT_MODEL
  );
}

// `KANEO_JEV_BASE_URL` is the full endpoint; `TYPESAFE_BASE_URL` follows the
// official SDK and is the API root the endpoint is appended to.
function jevEndpoint() {
  const explicit = process.env.KANEO_JEV_BASE_URL?.trim();
  if (explicit) {
    return explicit;
  }
  const root = process.env.TYPESAFE_BASE_URL?.trim().replace(/\/+$/, "");
  if (!root) {
    return DEFAULT_ENDPOINT;
  }
  return root.endsWith("/v1/systemone") ? root : `${root}/v1/systemone`;
}

function jevTimeoutMs() {
  return Math.max(1_000, envInt("KANEO_JEV_TIMEOUT_MS") ?? DEFAULT_TIMEOUT_MS);
}

function jevMaxRetries() {
  return Math.max(0, envInt("KANEO_JEV_MAX_RETRIES") ?? DEFAULT_MAX_RETRIES);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 408/429 and every 5xx are transient per the API reference and the SDK's
// RetryPolicy.
function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function retryAfterMs(response: Response): number | null {
  const millis = Number.parseInt(
    response.headers.get("retry-after-ms") ?? "",
    10,
  );
  if (Number.isFinite(millis) && millis >= 0) {
    return Math.min(millis, MAX_RETRY_AFTER_MS);
  }
  const seconds = Number.parseInt(
    response.headers.get("retry-after") ?? "",
    10,
  );
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, MAX_RETRY_AFTER_MS);
  }
  return null;
}

function backoffMs(response: Response | null, attempt: number): number {
  if (response) {
    const serverDelay = retryAfterMs(response);
    if (serverDelay !== null) {
      return serverDelay;
    }
  }
  const base = Math.min(BACKOFF_INITIAL_MS * 2 ** attempt, BACKOFF_MAX_MS);
  return base * (1 - Math.random() * BACKOFF_JITTER);
}

function parseJevBody(text: string): JevAnswers {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Jev returned malformed JSON");
  }
  const answers = (parsed as { answers?: unknown } | null)?.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    throw new Error("Jev response is missing answers");
  }
  return answers as JevAnswers;
}

// The default asker: one HTTP round trip, bounded retries on transient
// failures. Tests inject their own asker instead of stubbing the network.
export const askJev: JevAsker = async (state, questions) => {
  const apiKey = jevApiKey();
  if (!apiKey) {
    throw new Error("TYPESAFE_API_KEY is not configured");
  }

  const body = JSON.stringify({ model: jevModel(), state, questions });
  const maxRetries = jevMaxRetries();

  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(jevEndpoint(), {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(jevTimeoutMs()),
      });
    } catch (error) {
      if (attempt < maxRetries) {
        await delay(backoffMs(null, attempt));
        continue;
      }
      throw error;
    }

    if (isRetryableStatus(response.status) && attempt < maxRetries) {
      await delay(backoffMs(response, attempt));
      continue;
    }
    if (!response.ok) {
      throw new Error(`Jev request failed (${response.status})`);
    }
    return parseJevBody(await response.text());
  }
};
