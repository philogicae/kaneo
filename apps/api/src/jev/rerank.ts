// Jev scoring for retrieval: over-fetched candidates are scored one by one
// against the caller's query with a `score` question (five described
// relevance levels), batched under the request token budget, then ranked and
// cut with an absolute floor - ranking alone would keep a topk of junk for
// unrelated queries. Any failure returns null so the caller can fall back to
// its previous order.
//
// The official limits: 64k tokens per request, 32k for the state plus the
// longest question. Batches stay well under that, a candidate too large for
// its share is truncated, and a batch the estimate undercounted is halved and
// retried instead of failing the whole pass.
//
// Two hardening passes from the reference implementation:
// - answers keep their confidence, and `keepUnsure` lets low-confidence
//   rejects fill the remaining places after the sure ones: a dropped result
//   is invisible to the caller afterwards, so an unsure reject is cheap
//   insurance rather than a final decision.
// - candidate text is redacted before it leaves the machine (Jev is a
//   third-party API and board text routinely carries pasted secrets).

import {
  baseRequestTokens,
  envFlag,
  envRatio,
  estimateJevTokens,
  resolvedMaxRequestTokens,
  splitByBudget,
} from "./budget";
import {
  describeJevError,
  type JevAsker,
  JevError,
  type JevScoreQuestion,
  logJev,
} from "./client";
import { gatherBounded } from "./parallel";
import { redactSecrets } from "./redact";

// Hard ceiling on candidates sent to Jev in one retrieval pass.
export const CANDIDATE_CAP = 50;
// Candidate text sent to Jev; truncation would hide what the item actually
// does or contains.
const CANDIDATE_TEXT_CHARS = 4_000;
// A candidate may take at most a third of the budget, so the estimate can
// drift on one giant row without overflowing the request.
const PER_ITEM_BUDGET_FRACTION = 3;
const MIN_CANDIDATE_CHARS = 64;

// Minimum normalized usefulness (score / 4) a candidate must reach to be
// kept: 0.5 = "Possibly useful". The scale is generous - keep anything that
// could plausibly serve the query - and the floor is tunable live with
// KANEO_JEV_MIN_RATIO (0-1).
export const DEFAULT_MIN_RATIO = 0.5;

// Below this confidence, dropping a candidate is not safe enough to be final:
// the reference reranker keeps unsure rejects as cheap insurance.
export const UNSURE_CONFIDENCE = 0.5;

// The usefulness scale each candidate is scored against. Levels describe
// situations, not degrees: a "moderately relevant" level gives the model
// nothing to match against.
export const RELEVANCE_LEVELS: string[] = [
  "Unusable: it cannot plausibly answer the query",
  "Irrelevant: only a shared broad domain; a human would ask why it is here",
  "Possibly useful: it could plausibly serve as part of what the query asks for",
  "Useful: it performs or documents a step the query needs",
  "Core: exactly what the query asks for",
];

function resolvedMinRatio(value: number | undefined): number {
  return value ?? envRatio("KANEO_JEV_MIN_RATIO", DEFAULT_MIN_RATIO);
}

export type RerankOptions<T> = {
  query: string;
  items: T[];
  topk: number;
  ask: JevAsker;
  textOf: (item: T) => string;
  // What the candidates are (plural), so the question reads naturally.
  kind?: string;
  minRatio?: number;
  maxRequestTokens?: number;
  // Fill remaining places with candidates Jev was unsure about (confidence
  // below 0.5) instead of dropping them silently. Resolved from
  // KANEO_JEV_KEEP_UNSURE when unset.
  keepUnsure?: boolean;
};

/** A Jev answer's value plus its confidence (null when not reported). */
type Answer = {
  value: number;
  confidence: number | null;
};

function candidateText<T>(textOf: (item: T) => string, item: T): string {
  const text = redactSecrets(textOf(item)).trim();
  if (text.length <= CANDIDATE_TEXT_CHARS) {
    return text;
  }
  return `${text.slice(0, CANDIDATE_TEXT_CHARS)}…`;
}

function scoreQuestion(index: number, kind: string): JevScoreQuestion {
  return {
    type: "score",
    instructions:
      `\`query\` is what is being looked for and \`candidates\` are ${kind}, ` +
      `each with its metadata. Score how useful candidate \`c${index}\` could ` +
      "be for `query`. Be generous: keep anything that could plausibly serve " +
      "as part of what the query asks for. Sharing only a broad domain or a " +
      "common word is not enough by itself. Score Core only when it is " +
      "exactly what the query asks for, Useful when it performs or documents " +
      "a step the query needs, Possibly useful when it could plausibly serve " +
      "as part of the work, Irrelevant when only a shared broad domain, " +
      "Unusable when it cannot plausibly answer the query.",
    criteria: RELEVANCE_LEVELS,
  };
}

function answerConfidence(answer: Record<string, unknown>): number | null {
  const value = answer.confidence;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function scoreAnswer(
  answers: Record<string, Record<string, unknown>>,
  name: string,
): Answer {
  const answer = answers[name];
  const value = answer?.score;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new JevError(`Invalid Jev answer for ${name}`);
  }
  return { value, confidence: answerConfidence(answer ?? {}) };
}

function isMaxTokensError(error: unknown): boolean {
  return error instanceof JevError && error.errorType === "max_tokens_exceeded";
}

async function scoreCandidates<T>(
  options: RerankOptions<T>,
  entries: Array<{ id: string; content: string }>,
): Promise<Map<number, Answer>> {
  const { ask, query } = options;
  const maxRequestTokens = resolvedMaxRequestTokens(options.maxRequestTokens);
  const questionOf = (index: number) => {
    const name = `relevance_c${index}`;
    return [name, scoreQuestion(index, options.kind ?? "candidates")] as const;
  };

  // The query and the envelope are in every batch; the rest of the budget is
  // shared by the candidates.
  const itemBudget = Math.max(
    1,
    maxRequestTokens - baseRequestTokens({ query, candidates: [] }),
  );
  const perItemCap = Math.max(
    1,
    Math.floor(itemBudget / PER_ITEM_BUDGET_FRACTION),
  );

  const sized = entries.map((entry, index) => {
    const [name, question] = questionOf(index);
    const questionTokens = estimateJevTokens(
      JSON.stringify({ [name]: question }),
    );
    let entryTokens = estimateJevTokens(JSON.stringify(entry));
    // One huge row must not sink the whole shortlist: halve its text until it
    // fits its share of the budget.
    while (
      entryTokens > perItemCap &&
      entry.content.length > MIN_CANDIDATE_CHARS
    ) {
      entry.content = `${entry.content.slice(
        0,
        Math.max(MIN_CANDIDATE_CHARS, Math.floor(entry.content.length / 2)),
      )}…`;
      entryTokens = estimateJevTokens(JSON.stringify(entry));
    }
    return { index, tokens: entryTokens + questionTokens };
  });

  const askBatch = async (indexes: number[]): Promise<Map<number, Answer>> => {
    const questions = Object.fromEntries(
      indexes.map((index) => questionOf(index)),
    );
    try {
      const answers = await ask(
        {
          query,
          candidates: indexes.map((index) => entries[index]),
        },
        questions,
      );
      return new Map(
        indexes.map((index) => {
          const [name] = questionOf(index);
          return [index, scoreAnswer(answers, name)] as const;
        }),
      );
    } catch (error) {
      // The estimate undercounted this batch: halve it and ask both halves
      // instead of falling back to the embedding order. One oversized
      // candidate is a real failure and still throws.
      if (!isMaxTokensError(error) || indexes.length <= 1) {
        throw error;
      }
      const mid = Math.floor(indexes.length / 2);
      const halves = await Promise.all([
        askBatch(indexes.slice(0, mid)),
        askBatch(indexes.slice(mid)),
      ]);
      return new Map(halves.flatMap((half) => [...half]));
    }
  };

  const results = await gatherBounded(
    splitByBudget(sized, itemBudget).map(
      (batch) => () => askBatch(batch.map((item) => item.index)),
    ),
  );
  return new Map(results.flatMap((result) => [...result]));
}

export async function rerankByRelevance<T>(
  options: RerankOptions<T>,
): Promise<T[] | null> {
  const { items, topk, textOf } = options;

  if (items.length <= 1) {
    return items.slice(0, topk);
  }
  // Merged results across queries can exceed the pool: keep the caller's best
  // candidates (callers pass them best-first).
  const candidates = items.slice(0, CANDIDATE_CAP);
  const entries = candidates.map((item, index) => ({
    id: `c${index}`,
    content: candidateText(textOf, item),
  }));

  let scores: Map<number, Answer>;
  try {
    scores = await scoreCandidates(options, entries);
  } catch (error) {
    const detail = describeJevError(error);
    console.warn(`[jev] reranking skipped: ${detail}`);
    logJev("rerank_skipped", {
      query: options.query.slice(0, 300),
      candidates: candidates.length,
      reason: error instanceof JevError ? error.errorType : "",
      error: detail,
    });
    return null;
  }

  const levelSpan = Math.max(RELEVANCE_LEVELS.length - 1, 1);
  const floor = resolvedMinRatio(options.minRatio);
  const answers = candidates.map(
    (_, index) => scores.get(index) ?? { value: 0, confidence: null },
  );
  const ranked = candidates
    .map((_, index) => index)
    .sort(
      (a, b) => (answers[b]?.value ?? 0) - (answers[a]?.value ?? 0) || a - b,
    );
  const sure = ranked.filter(
    (index) => (answers[index]?.value ?? 0) / levelSpan >= floor,
  );
  const keepUnsure =
    options.keepUnsure ?? envFlag("KANEO_JEV_KEEP_UNSURE", false);
  const sureSet = new Set(sure);
  const unsure = keepUnsure
    ? ranked.filter(
        (index) =>
          !sureSet.has(index) &&
          (answers[index]?.confidence ?? 1) < UNSURE_CONFIDENCE,
      )
    : [];
  const kept = [...sure, ...unsure].slice(0, topk);

  logJev("rerank", {
    query: options.query.slice(0, 300),
    kind: options.kind ?? "candidates",
    candidates: candidates.length,
    min_ratio: floor,
    kept: kept.length,
    unsure_kept: Math.min(unsure.length, Math.max(topk - sure.length, 0)),
  });

  return kept.map((index) => candidates[index] as T);
}
