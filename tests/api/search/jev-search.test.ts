import { afterEach, describe, expect, it, vi } from "vitest";
import type { JevAnswers, JevAsker } from "../../../apps/api/src/jev/client";
import {
  rerankSearchResults,
  searchResultText,
} from "../../../apps/api/src/search/jev-search";

type Result = {
  id: string;
  type: string;
  title: string;
  description?: string;
  content?: string;
  projectName?: string;
  projectSlug?: string;
  workspaceName?: string;
  taskNumber?: number;
  relevanceScore: number;
};

function result(id: string, title: string, relevanceScore = 2): Result {
  return { id, type: "task", title, relevanceScore };
}

function scoringAsker(scoreOf: (content: string) => number): JevAsker {
  return async (state, questions) => {
    const candidates = (
      state as { candidates: Array<{ id: string; content: string }> }
    ).candidates;
    const answers: JevAnswers = {};
    for (const name of Object.keys(questions)) {
      const id = name.replace("relevance_", "");
      const candidate = candidates.find((entry) => entry.id === id);
      answers[name] = { score: candidate ? scoreOf(candidate.content) : 0 };
    }
    return answers;
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("searchResultText", () => {
  it("renders the identification fields Jev judges on", () => {
    const text = searchResultText({
      id: "t1",
      type: "task",
      title: "Fix login",
      description: "The form loops",
      projectName: "kaneo",
      projectSlug: "KAN",
      workspaceName: "Private Projects: Dev",
      taskNumber: 113,
      relevanceScore: 3,
    });

    expect(text).toContain("type: task");
    expect(text).toContain("title: Fix login");
    expect(text).toContain("description: The form loops");
    expect(text).toContain("project: kaneo (KAN)");
    expect(text).toContain("workspace: Private Projects: Dev");
    expect(text).toContain("task: KAN-113");
  });
});

describe("rerankSearchResults", () => {
  it("keeps the SQL order when Jev is disabled", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const results = [result("a", "alpha"), result("b", "beta")];

    const outcome = await rerankSearchResults(results, "q", 1);

    expect(outcome.results.map((item) => item.id)).toEqual(["a"]);
    expect(outcome.totalCount).toBe(2);
  });

  it("ranks by Jev score and drops irrelevant results", async () => {
    const results = [
      result("a", "alpha"),
      result("b", "beta"),
      result("c", "gamma"),
    ];
    const ask = scoringAsker((content) =>
      content.includes("gamma") ? 4 : content.includes("beta") ? 0 : 2,
    );

    const outcome = await rerankSearchResults(results, "gamma", 2, ask);

    expect(outcome.results.map((item) => item.id)).toEqual(["c", "a"]);
    expect(outcome.totalCount).toBe(2);
  });

  it("pins exact short-id matches on top and never scores them", async () => {
    const results = [
      result("exact", "KAN-113", 10),
      result("a", "alpha"),
      result("b", "beta"),
    ];
    const scored: string[] = [];
    const ask: JevAsker = async (state) => {
      const candidates = (state as { candidates: Array<{ id: string }> })
        .candidates;
      for (const candidate of candidates) {
        scored.push(candidate.id);
      }
      return Object.fromEntries(
        candidates.map((candidate) => [
          `relevance_${candidate.id}`,
          { score: 4 },
        ]),
      );
    };

    const outcome = await rerankSearchResults(results, "KAN-113", 2, ask);

    expect(outcome.results.map((item) => item.id)).toEqual(["exact", "a"]);
    expect(scored).not.toContain("exact");
  });

  it("falls back to the SQL order when Jev fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const results = [result("a", "alpha"), result("b", "beta")];

    const outcome = await rerankSearchResults(results, "q", 2, async () => {
      throw new Error("boom");
    });

    expect(outcome.results.map((item) => item.id)).toEqual(["a", "b"]);
    expect(outcome.totalCount).toBe(2);
    warn.mockRestore();
  });

  it("can return no result when nothing is relevant", async () => {
    const results = [result("a", "alpha"), result("b", "beta")];

    const outcome = await rerankSearchResults(
      results,
      "q",
      5,
      scoringAsker(() => 0),
    );

    expect(outcome.results).toEqual([]);
    expect(outcome.totalCount).toBe(0);
  });
});
