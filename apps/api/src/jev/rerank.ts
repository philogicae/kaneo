// Jev scoring for retrieval: over-fetched candidates are scored one by one
// against the caller's query with a `score` question (five described
// relevance levels), batched under the request token budget, then ranked and
// cut with an absolute floor - ranking alone would keep a topk of junk for
// unrelated queries. Any failure returns null so the caller can fall back to
// its previous order.
//
// The official limits: 64k tokens per request, 32k for the state plus the
// longest question. Batches stay well under that, and a candidate too large
// for its share is truncated instead of failing the whole pass.

import {
  baseRequestTokens,
  envRatio,
  estimateJevTokens,
  resolvedMaxRequestTokens,
  splitByBudget,
} from "./budget";
import type { JevAsker, JevScoreQuestion } from "./client";

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
};

function candidateText<T>(textOf: (item: T) => string, item: T): string {
  const text = textOf(item).trim();
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

function scoreAnswer(
  answers: Record<string, Record<string, unknown>>,
  name: string,
): number {
  const value = answers[name]?.score;
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new TypeError(`Invalid Jev answer for ${name}`);
  }
  return value;
}

async function scoreCandidates<T>(
  options: RerankOptions<T>,
  entries: Array<{ id: string; content: string }>,
): Promise<Map<number, number>> {
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

  const perBatch = await Promise.all(
    splitByBudget(sized, itemBudget).map(async (batch) => {
      const indexes = batch.map((item) => item.index);
      const questions = Object.fromEntries(
        indexes.map((index) => questionOf(index)),
      );
      const answers = await ask(
        {
          query,
          candidates: indexes.map((index) => entries[index]),
        },
        questions,
      );
      return indexes.map((index) => {
        const [name] = questionOf(index);
        return [index, scoreAnswer(answers, name)] as const;
      });
    }),
  );

  return new Map(perBatch.flat());
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

  let scores: Map<number, number>;
  try {
    scores = await scoreCandidates(options, entries);
  } catch (error) {
    console.warn(
      `[jev] reranking skipped: ${error instanceof Error ? error.message : error}`,
    );
    return null;
  }

  const levelSpan = Math.max(RELEVANCE_LEVELS.length - 1, 1);
  const floor = resolvedMinRatio(options.minRatio);
  const ranked = candidates
    .map((_, index) => index)
    .sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0) || a - b);
  const kept = ranked
    .filter((index) => (scores.get(index) ?? 0) / levelSpan >= floor)
    .slice(0, topk);

  return kept.map((index) => candidates[index] as T);
}
