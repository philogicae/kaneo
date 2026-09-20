// Jev (TypeSafe System One) is a typed judgment API: the caller sends a
// `state` plus a map of `questions` (`noul`, `choice`, `score`) and receives
// calibrated answers instead of prose. Every integration is opt-in and
// fail-open: without TYPESAFE_API_KEY, or on any failure, callers keep their
// previous behavior.
//
// Defaults mirror the official JavaScript SDK: 10s per attempt, two retries
// with jittered backoff, retrying 408/425/429/5xx and honoring `Retry-After`.
// Every knob stays overridable through env. On top of the SDK shape, this
// client carries the reference implementation's hardening: typed errors with
// the API's `error_type`, validation of every answer against the question
// that asked for it (a partial or mistyped response never becomes a
// confident answer), a model requirement on responses (an upstream model
// swap used to degrade answers silently) and a structured provenance line
// per call for the audit trail.

const DEFAULT_MODEL = "jev-latest";
const DEFAULT_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const BACKOFF_INITIAL_MS = 300;
const BACKOFF_MAX_MS = 5_000;
const BACKOFF_JITTER = 0.2;
const MAX_RETRY_AFTER_MS = 60_000;
const SAFE_ERROR_TYPE = /^[A-Za-z0-9_:-]{1,80}$/;

// Published rate of the reference cost meter; used only for the estimate in
// the audit log, never for billing.
const JEV_USD_PER_MTOK = 0.042;

export class JevError extends Error {
  status: number;
  errorType: string;

  constructor(message: string, status = 0, errorType = "") {
    super(message);
    this.name = "JevError";
    this.status = status;
    this.errorType = errorType;
  }
}

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

// 408/425/429 and every 5xx are transient per the API reference and the SDK's
// RetryPolicy.
function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
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

// The API's error_type (top level or nested under `detail`), never free text:
// only a bounded identifier-shaped value is trusted enough to log or branch
// on.
function errorTypeOf(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }
  const record = payload as Record<string, unknown>;
  let value = record.error_type;
  const detail = record.detail;
  if (
    typeof value !== "string" &&
    detail &&
    typeof detail === "object" &&
    !Array.isArray(detail)
  ) {
    value = (detail as Record<string, unknown>).error_type;
  }
  return typeof value === "string" && SAFE_ERROR_TYPE.test(value) ? value : "";
}

// Fixed failure categories for the audit log (never upstream free text).
export function failureReason(status: number, errorType: string): string {
  if (
    errorType === "timeout" ||
    errorType === "network" ||
    errorType === "malformed_response" ||
    errorType === "invalid_answer" ||
    errorType === "max_tokens_exceeded"
  ) {
    return errorType;
  }
  if (status === 429) {
    return "rate_limit";
  }
  if (status === 401 || status === 402 || status === 403) {
    return "credentials_or_credit";
  }
  return "upstream_error";
}

/** One structured audit line per Jev call; provenance without payloads. */
export function logJev(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ jev: event, ...fields }));
}

/** Human-readable error with the failure category for the caller's log line. */
export function describeJevError(error: unknown): string {
  if (error instanceof JevError) {
    const reason = failureReason(error.status, error.errorType);
    return reason && !error.message.includes(reason)
      ? `${error.message} (${reason})`
      : error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

function isProbability(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function validateAnswer(
  name: string,
  question: JevQuestion,
  answer: Record<string, unknown>,
) {
  if (question.type === "noul") {
    if (!isProbability(answer.noul)) {
      throw new JevError(
        `Jev answer ${name} is not a probability`,
        200,
        "invalid_answer",
      );
    }
    return;
  }
  if (question.type === "choice") {
    const criteria = new Set(Object.keys(question.criteria));
    const probabilities = answer.probabilities;
    if (
      !probabilities ||
      typeof probabilities !== "object" ||
      Array.isArray(probabilities)
    ) {
      throw new JevError(
        `Jev answer ${name} misses criteria probabilities`,
        200,
        "invalid_answer",
      );
    }
    const record = probabilities as Record<string, unknown>;
    const missing = [...criteria].filter((key) => !(key in record));
    if (missing.length > 0) {
      throw new JevError(
        `Jev answer ${name} misses criteria probabilities`,
        200,
        "invalid_answer",
      );
    }
    for (const key of criteria) {
      if (!isProbability(record[key])) {
        throw new JevError(
          `Jev answer ${name} has invalid probabilities`,
          200,
          "invalid_answer",
        );
      }
    }
    if (typeof answer.choice !== "string" || !criteria.has(answer.choice)) {
      throw new JevError(
        `Jev answer ${name} chose an unknown option`,
        200,
        "invalid_answer",
      );
    }
    return;
  }
  const score = answer.score;
  if (typeof score !== "number" || !Number.isFinite(score)) {
    throw new JevError(
      `Jev answer ${name} has no numeric score`,
      200,
      "invalid_answer",
    );
  }
}

/** Reject a response that omits or mistypes a requested answer. */
export function validateAnswers(
  questions: Record<string, JevQuestion>,
  answers: JevAnswers,
) {
  for (const [name, question] of Object.entries(questions)) {
    const answer = answers[name];
    if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
      throw new JevError(`Jev omitted answer ${name}`, 200, "invalid_answer");
    }
    validateAnswer(name, question, answer);
  }
}

function parseJevBody(
  status: number,
  ok: boolean,
  text: string,
  questions: Record<string, JevQuestion>,
): JevAnswers {
  if (!ok) {
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
    throw new JevError(
      `Jev request failed (${status})`,
      status,
      errorTypeOf(payload),
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new JevError(
      "Jev returned malformed JSON",
      status,
      "malformed_response",
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new JevError(
      "Jev response is missing answers",
      status,
      "malformed_response",
    );
  }
  const record = parsed as Record<string, unknown>;
  const answers = record.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    throw new JevError(
      "Jev response is missing answers",
      status,
      "malformed_response",
    );
  }
  // The response model is the only record of which upstream model answered;
  // without it a silent model swap cannot be audited.
  if (typeof record.model !== "string" || !record.model) {
    throw new JevError(
      "Jev response is missing model",
      status,
      "malformed_response",
    );
  }
  validateAnswers(questions, answers as JevAnswers);
  return answers as JevAnswers;
}

function provenanceOf(text: string) {
  let model = "";
  let inputTokens = 0;
  try {
    const parsed = JSON.parse(text) as {
      model?: unknown;
      usage?: { input_tokens?: unknown };
    };
    if (typeof parsed.model === "string") {
      model = parsed.model;
    }
    const tokens = parsed.usage?.input_tokens;
    if (typeof tokens === "number" && Number.isFinite(tokens) && tokens >= 0) {
      inputTokens = Math.floor(tokens);
    }
  } catch {
    // Provenance is best-effort; parsing already validated the body.
  }
  return {
    model,
    input_tokens: inputTokens,
    usd: Number(((inputTokens * JEV_USD_PER_MTOK) / 1e6).toFixed(8)),
  };
}

// The default asker: one HTTP round trip, bounded retries on transient
// failures and on a malformed 2xx (a partial response is retried like a
// transport failure, never turned into answers). Tests inject their own asker
// instead of stubbing the network.
export const askJev: JevAsker = async (state, questions) => {
  const apiKey = jevApiKey();
  if (!apiKey) {
    throw new JevError("TYPESAFE_API_KEY is not configured");
  }

  const body = JSON.stringify({
    model: jevModel(),
    state,
    questions,
  });
  const maxRetries = jevMaxRetries();

  for (let attempt = 0; ; attempt++) {
    let response: Response;
    const startedAt = Date.now();
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
      const timedOut =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      const errorType = timedOut ? "timeout" : "network";
      if (attempt < maxRetries) {
        logJev("retry", {
          attempt: attempt + 1,
          reason: errorType,
          duration_ms: Date.now() - startedAt,
        });
        await delay(backoffMs(null, attempt));
        continue;
      }
      logJev("failed", {
        status: 0,
        reason: errorType,
        attempt: attempt + 1,
        duration_ms: Date.now() - startedAt,
      });
      throw new JevError(
        error instanceof Error ? error.message : String(error),
        0,
        errorType,
      );
    }

    const text = await response.text();
    try {
      const answers = parseJevBody(
        response.status,
        response.ok,
        text,
        questions,
      );
      logJev("ok", {
        status: response.status,
        attempt: attempt + 1,
        duration_ms: Date.now() - startedAt,
        ...provenanceOf(text),
      });
      return answers;
    } catch (error) {
      const jevError =
        error instanceof JevError
          ? error
          : new JevError(String(error), response.status);
      const reason = failureReason(jevError.status, jevError.errorType);
      // Documented retryables plus a malformed 2xx; anything else (auth,
      // credit, 4xx) is final.
      const retryable = isRetryableStatus(response.status) || response.ok;
      if (retryable && attempt < maxRetries) {
        logJev("retry", {
          status: response.status,
          reason,
          attempt: attempt + 1,
          duration_ms: Date.now() - startedAt,
        });
        await delay(backoffMs(response, attempt));
        continue;
      }
      logJev("failed", {
        status: response.status,
        reason,
        attempt: attempt + 1,
        duration_ms: Date.now() - startedAt,
      });
      throw jevError;
    }
  }
};
