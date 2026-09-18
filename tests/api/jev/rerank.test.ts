import { afterEach, describe, expect, it, vi } from "vitest";
import { estimateJevTokens } from "../../../apps/api/src/jev/budget";
import type { JevAnswers, JevAsker } from "../../../apps/api/src/jev/client";
import {
  CANDIDATE_CAP,
  DEFAULT_MIN_RATIO,
  RELEVANCE_LEVELS,
  rerankByRelevance,
} from "../../../apps/api/src/jev/rerank";

afterEach(() => {
  vi.unstubAllEnvs();
});

type Item = { id: string; text: string };

const textOf = (item: Item) => item.text;

function scoringAsker(
  scoreOf: (text: string) => number,
  seen?: { batchSizes: number[] },
): JevAsker {
  return async (state, questions) => {
    const candidates = (
      state as { candidates: Array<{ id: string; content: string }> }
    ).candidates;
    seen?.batchSizes.push(candidates.length);
    const answers: JevAnswers = {};
    for (const name of Object.keys(questions)) {
      const id = name.replace("relevance_", "");
      const candidate = candidates.find((entry) => entry.id === id);
      answers[name] = { score: candidate ? scoreOf(candidate.content) : 0 };
    }
    return answers;
  };
}

describe("estimateJevTokens", () => {
  it("counts words, digits and symbols like the reference estimator", () => {
    expect(estimateJevTokens("")).toBe(0);
    expect(estimateJevTokens("abc")).toBe(1);
    expect(estimateJevTokens("abcdefgh")).toBe(2);
    expect(estimateJevTokens("1234")).toBe(2);
    expect(estimateJevTokens("{}")).toBe(2);
    expect(estimateJevTokens("hello world")).toBe(2);
  });
});

describe("rerankByRelevance", () => {
  it("returns short lists untouched without asking Jev", async () => {
    const ask = vi.fn(scoringAsker(() => 4));
    const items: Item[] = [{ id: "a", text: "only" }];

    const kept = await rerankByRelevance({
      query: "q",
      items,
      topk: 5,
      textOf,
      ask,
    });

    expect(kept).toEqual(items);
    expect(ask).not.toHaveBeenCalled();
  });

  it("orders by score and drops candidates under the floor", async () => {
    const items: Item[] = [
      { id: "a", text: "alpha" },
      { id: "b", text: "beta" },
      { id: "c", text: "gamma" },
    ];
    const ask = scoringAsker((text) =>
      text === "alpha" ? 4 : text === "gamma" ? 2 : 0,
    );

    const kept = await rerankByRelevance({
      query: "q",
      items,
      topk: 2,
      textOf,
      ask,
    });

    expect(kept?.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("keeps the original order for equal scores", async () => {
    const items: Item[] = [
      { id: "a", text: "alpha" },
      { id: "b", text: "beta" },
      { id: "c", text: "gamma" },
    ];

    const kept = await rerankByRelevance({
      query: "q",
      items,
      topk: 2,
      textOf,
      ask: scoringAsker(() => 3),
    });

    expect(kept?.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("can return nothing when every candidate is below the floor", async () => {
    const items: Item[] = [
      { id: "a", text: "alpha" },
      { id: "b", text: "beta" },
    ];

    const kept = await rerankByRelevance({
      query: "q",
      items,
      topk: 5,
      textOf,
      ask: scoringAsker(() => 1),
    });

    expect(kept).toEqual([]);
    expect(DEFAULT_MIN_RATIO).toBe(0.5);
    expect(RELEVANCE_LEVELS).toHaveLength(5);
  });

  it("reads the floor from KANEO_JEV_MIN_RATIO when no override is passed", async () => {
    vi.stubEnv("KANEO_JEV_MIN_RATIO", "1");
    const items: Item[] = [
      { id: "a", text: "alpha" },
      { id: "b", text: "beta" },
    ];

    const kept = await rerankByRelevance({
      query: "q",
      items,
      topk: 5,
      textOf,
      ask: scoringAsker((text) => (text === "alpha" ? 4 : 3)),
    });

    expect(kept?.map((item) => item.id)).toEqual(["a"]);
  });

  it("honors a stricter minRatio", async () => {
    const items: Item[] = [
      { id: "a", text: "alpha" },
      { id: "b", text: "beta" },
    ];

    const kept = await rerankByRelevance({
      query: "q",
      items,
      topk: 5,
      textOf,
      minRatio: 1,
      ask: scoringAsker((text) => (text === "alpha" ? 4 : 3.5)),
    });

    expect(kept?.map((item) => item.id)).toEqual(["a"]);
  });

  it("caps how many candidates are sent to Jev", async () => {
    const seen = { batchSizes: [] as number[] };
    const items: Item[] = Array.from(
      { length: CANDIDATE_CAP + 10 },
      (_, i) => ({
        id: `i${i}`,
        text: "good",
      }),
    );

    const kept = await rerankByRelevance({
      query: "q",
      items,
      topk: 5,
      textOf,
      ask: scoringAsker(() => 4, seen),
    });

    expect(kept).toHaveLength(5);
    expect(Math.max(...seen.batchSizes)).toBe(CANDIDATE_CAP);
    expect(seen.batchSizes.reduce((sum, size) => sum + size, 0)).toBe(
      CANDIDATE_CAP,
    );
  });

  it("splits candidates into budget-fitting batches", async () => {
    const seen = { batchSizes: [] as number[] };
    const items: Item[] = Array.from({ length: 6 }, (_, i) => ({
      id: `i${i}`,
      text: `${"x".repeat(400)}-${i}`,
    }));

    const kept = await rerankByRelevance({
      query: "q",
      items,
      topk: 2,
      textOf,
      maxRequestTokens: 600,
      ask: scoringAsker((text) => (text.endsWith("-0") ? 4 : 0), seen),
    });

    expect(kept?.map((item) => item.id)).toEqual(["i0"]);
    expect(seen.batchSizes.length).toBeGreaterThan(1);
  });

  it("runs budget batches in parallel", async () => {
    const items: Item[] = Array.from({ length: 4 }, (_, index) => ({
      id: `i${index}`,
      text: "x".repeat(400),
    }));
    let inFlight = 0;
    let maxInFlight = 0;

    const kept = await rerankByRelevance({
      query: "q",
      items,
      topk: 1,
      textOf,
      maxRequestTokens: 600,
      ask: async (_state, questions) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return Object.fromEntries(
          Object.keys(questions).map((name) => [name, { score: 4 }]),
        );
      },
    });

    expect(kept).toHaveLength(1);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it("truncates an oversized candidate instead of failing the pass", async () => {
    const seen: string[] = [];
    const items: Item[] = [
      { id: "huge", text: "x".repeat(20_000) },
      { id: "small", text: "alpha" },
    ];

    const kept = await rerankByRelevance({
      query: "q",
      items,
      topk: 2,
      textOf,
      maxRequestTokens: 1_200,
      ask: async (state, questions) => {
        const candidates = (
          state as { candidates: Array<{ id: string; content: string }> }
        ).candidates;
        for (const candidate of candidates) {
          seen.push(candidate.content);
        }
        return Object.fromEntries(
          Object.keys(questions).map((name) => [name, { score: 4 }]),
        );
      },
    });

    expect(kept?.map((item) => item.id)).toEqual(["huge", "small"]);
    const hugeContent = seen.find((content) => content.startsWith("x"));
    expect(hugeContent?.length).toBeLessThan(20_000);
    expect(hugeContent?.endsWith("…")).toBe(true);
  });

  it("returns null so the caller can fall back when Jev fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const kept = await rerankByRelevance({
      query: "q",
      items: [
        { id: "a", text: "alpha" },
        { id: "b", text: "beta" },
      ],
      topk: 2,
      textOf,
      ask: async () => {
        throw new Error("boom");
      },
    });

    expect(kept).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("returns null when an answer is missing its score", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const kept = await rerankByRelevance({
      query: "q",
      items: [
        { id: "a", text: "alpha" },
        { id: "b", text: "beta" },
      ],
      topk: 2,
      textOf,
      ask: async () => ({}),
    });

    expect(kept).toBeNull();
    warn.mockRestore();
  });
});
