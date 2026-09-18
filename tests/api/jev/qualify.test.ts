import { afterEach, describe, expect, it, vi } from "vitest";
import {
  estimateJevTokens,
  MAX_REQUEST_TOKENS,
} from "../../../apps/api/src/jev/budget";
import type {
  JevAnswers,
  JevAsker,
  JevQuestion,
} from "../../../apps/api/src/jev/client";
import {
  isSemanticLabel,
  PRIORITY_CRITERIA,
  type QualificationLabel,
  suggestTaskQualification,
} from "../../../apps/api/src/jev/qualify";

afterEach(() => {
  vi.unstubAllEnvs();
});

const LABELS: QualificationLabel[] = [
  { id: "l1", name: "bug", color: "purple" },
  { id: "l2", name: "feature", color: "purple" },
  { id: "l3", name: "branch:main", color: "dark-gray" },
  { id: "l4", name: "machine:pc", color: "yellow" },
  { id: "l5", name: "docs", color: "purple" },
];

function fakeAsker(options: {
  choice?: unknown;
  confidence?: number;
  nouls?: Record<string, number>;
  onAsk?: (state: unknown, questions: Record<string, JevQuestion>) => void;
}): JevAsker {
  return async (state, questions) => {
    options.onAsk?.(state, questions);
    const answers: JevAnswers = {
      priority: {
        choice: options.choice ?? "medium",
        confidence: options.confidence ?? 0.9,
      },
    };
    for (const key of Object.keys(questions)) {
      if (key.startsWith("label_")) {
        answers[key] = { noul: options.nouls?.[key] ?? 0 };
      }
    }
    return answers;
  };
}

describe("isSemanticLabel", () => {
  it("excludes branch and machine labels", () => {
    expect(isSemanticLabel("bug")).toBe(true);
    expect(isSemanticLabel("Branch:main")).toBe(false);
    expect(isSemanticLabel(" machine:pc ")).toBe(false);
  });
});

describe("suggestTaskQualification", () => {
  it("returns null without a key and without an injected asker", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");

    const result = await suggestTaskQualification({
      title: "Fix login",
      labels: LABELS,
    });

    expect(result).toBeNull();
  });

  it("picks the priority and keeps only semantic labels above the threshold", async () => {
    let asked = "";
    const result = await suggestTaskQualification({
      title: "Fix the login redirect loop",
      description: "Users bounce between the callback and the sign-in page.",
      labels: LABELS,
      ask: fakeAsker({
        choice: "high",
        confidence: 0.82,
        nouls: { label_0: 0.8, label_1: 0.4, label_2: 0.6 },
        onAsk: (_state, questions) => {
          asked = JSON.stringify(questions);
        },
      }),
    });

    expect(result).toEqual({
      priority: "high",
      priorityConfidence: 0.82,
      labels: [
        { id: "l1", name: "bug", color: "purple", probability: 0.8 },
        { id: "l5", name: "docs", color: "purple", probability: 0.6 },
      ],
    });
    expect(asked).not.toContain("branch:main");
    expect(asked).not.toContain("machine:pc");
  });

  it("carries the creator's priority as a hint", async () => {
    let questions: Record<string, JevQuestion> | undefined;
    await suggestTaskQualification({
      title: "Ship the release",
      labels: [],
      providedPriority: "high",
      ask: fakeAsker({
        onAsk: (_state, askedQuestions) => {
          questions = askedQuestions;
        },
      }),
    });

    expect(questions?.priority?.instructions).toContain(
      'pre-filled the priority "high"',
    );

    await suggestTaskQualification({
      title: "Ship the release",
      labels: [],
      providedPriority: "no-priority",
      ask: fakeAsker({
        onAsk: (_state, askedQuestions) => {
          questions = askedQuestions;
        },
      }),
    });

    expect(questions?.priority?.instructions).toContain(
      "left the priority unset",
    );
  });

  it("honors a custom label threshold", async () => {
    const result = await suggestTaskQualification({
      title: "Fix the login redirect loop",
      labels: LABELS,
      labelThreshold: 0.75,
      ask: fakeAsker({ nouls: { label_0: 0.7, label_1: 0.8 } }),
    });

    expect(result?.labels.map((label) => label.name)).toEqual(["feature"]);
  });

  it("reads the label threshold from KANEO_JEV_LABEL_THRESHOLD", async () => {
    vi.stubEnv("KANEO_JEV_LABEL_THRESHOLD", "0.9");

    const result = await suggestTaskQualification({
      title: "Fix the login redirect loop",
      labels: LABELS,
      ask: fakeAsker({ nouls: { label_0: 0.7 } }),
    });

    expect(result?.labels).toEqual([]);
  });

  it("falls back to the provided priority when Jev returns an unknown choice", async () => {
    const result = await suggestTaskQualification({
      title: "Fix the login redirect loop",
      labels: [],
      providedPriority: "low",
      ask: fakeAsker({ choice: "critical" }),
    });

    expect(result?.priority).toBe("low");
    expect(result?.priorityConfidence).toBe(0.9);
  });

  it("falls back to no-priority when nothing valid was provided", async () => {
    const result = await suggestTaskQualification({
      title: "Fix the login redirect loop",
      labels: [],
      ask: fakeAsker({ choice: "critical" }),
    });

    expect(result?.priority).toBe("no-priority");
  });

  it("returns null when the asker fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await suggestTaskQualification({
      title: "Fix the login redirect loop",
      labels: LABELS,
      ask: async () => {
        throw new Error("boom");
      },
    });

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("caps a huge description so the request stays under the budget", async () => {
    let state: { task?: { description?: string } } | undefined;
    let questions: Record<string, JevQuestion> | undefined;

    const result = await suggestTaskQualification({
      title: "Fix the login redirect loop",
      description: "x".repeat(300_000),
      labels: LABELS,
      ask: fakeAsker({
        onAsk: (askedState, askedQuestions) => {
          state = askedState as { task?: { description?: string } };
          questions = askedQuestions;
        },
      }),
    });

    expect(result).not.toBeNull();
    const description = state?.task?.description ?? "";
    expect(description.length).toBe(8_000);
    expect(
      estimateJevTokens(JSON.stringify({ state, questions })),
    ).toBeLessThanOrEqual(MAX_REQUEST_TOKENS);
  });

  it("splits label questions into parallel budget-fitting batches", async () => {
    const labels: QualificationLabel[] = Array.from(
      { length: 40 },
      (_, index) => ({
        id: `l${index}`,
        name: `label-${index}`,
        color: "purple",
      }),
    );
    const calls: Array<{
      state: unknown;
      questions: Record<string, JevQuestion>;
    }> = [];
    let inFlight = 0;
    let maxInFlight = 0;

    const result = await suggestTaskQualification({
      title: "Batched qualification",
      labels,
      maxRequestTokens: 1_500,
      ask: async (state, questions) => {
        calls.push({ state, questions });
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return Object.fromEntries(
          Object.keys(questions).map((name) => [
            name,
            name === "priority"
              ? { choice: "medium", confidence: 0.9 }
              : { noul: 0.9 },
          ]),
        );
      },
    });

    expect(result?.priority).toBe("medium");
    expect(result?.labels).toHaveLength(40);
    expect(calls.length).toBeGreaterThan(1);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(calls.filter((call) => "priority" in call.questions)).toHaveLength(
      1,
    );
    for (const call of calls) {
      expect(
        estimateJevTokens(
          JSON.stringify({ state: call.state, questions: call.questions }),
        ),
      ).toBeLessThanOrEqual(1_500);
    }
  });

  it("reads the request budget from KANEO_JEV_MAX_REQUEST_TOKENS", async () => {
    vi.stubEnv("KANEO_JEV_MAX_REQUEST_TOKENS", "1200");
    const labels: QualificationLabel[] = Array.from(
      { length: 40 },
      (_, index) => ({
        id: `l${index}`,
        name: `label-${index}`,
        color: "purple",
      }),
    );
    let calls = 0;

    const result = await suggestTaskQualification({
      title: "Batched qualification",
      labels,
      ask: async (_state, questions) => {
        calls++;
        return Object.fromEntries(
          Object.keys(questions).map((name) => [
            name,
            name === "priority"
              ? { choice: "low", confidence: 0.9 }
              : { noul: 0.9 },
          ]),
        );
      },
    });

    expect(result?.priority).toBe("low");
    expect(calls).toBeGreaterThan(1);
  });

  it("exposes the documented priority scale", () => {
    expect(Object.keys(PRIORITY_CRITERIA)).toEqual([
      "no-priority",
      "low",
      "medium",
      "high",
      "urgent",
    ]);
  });
});
