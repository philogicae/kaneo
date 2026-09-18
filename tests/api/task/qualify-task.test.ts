import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.fn();

vi.mock("../../../apps/api/src/database", () => ({
  default: { select: (...args: unknown[]) => mockSelect(...args) },
}));

import {
  labelTable,
  projectTable,
} from "../../../apps/api/src/database/schema";
import type { JevAsker } from "../../../apps/api/src/jev/client";
import qualifyTask, {
  loadQualificationContext,
} from "../../../apps/api/src/task/controllers/qualify-task";

const PROJECT = {
  name: "kaneo",
  workspaceId: "ws1",
  workspaceName: "Private Projects: Dev",
};
const LABELS = [{ id: "l1", name: "bug", color: "purple" }];

function fromChain(table: unknown) {
  if (table === projectTable) {
    return {
      innerJoin: () => ({
        where: () => ({ limit: () => Promise.resolve([PROJECT]) }),
      }),
    };
  }
  if (table === labelTable) {
    return { where: () => Promise.resolve(LABELS) };
  }
  throw new Error("Unexpected table in the qualify query");
}

function missingProjectChain(table: unknown) {
  if (table === projectTable) {
    return {
      innerJoin: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
      }),
    };
  }
  return fromChain(table);
}

beforeEach(() => {
  mockSelect.mockReset();
  mockSelect.mockImplementation(() => ({ from: fromChain }));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadQualificationContext", () => {
  it("resolves the project names and the workspace-level labels", async () => {
    const context = await loadQualificationContext("p1");

    expect(context).toEqual({
      workspaceId: "ws1",
      projectName: "kaneo",
      workspaceName: "Private Projects: Dev",
      labels: LABELS,
    });
  });
});

describe("qualifyTask", () => {
  it("asks Jev with the loaded context and returns the suggestion", async () => {
    let askedQuestions: Record<string, unknown> | undefined;
    const ask: JevAsker = async (_askedState, questions) => {
      askedQuestions = questions;
      return {
        priority: { choice: "high", confidence: 0.8 },
        ...Object.fromEntries(
          Object.keys(questions)
            .filter((key) => key.startsWith("label_"))
            .map((key) => [key, { noul: 0.9 }]),
        ),
      };
    };

    const result = await qualifyTask({
      projectId: "p1",
      title: "Fix the login redirect loop",
      description: "Users bounce between the callback and the sign-in page.",
      priority: "low",
      ask,
    });

    expect(result).toEqual({
      priority: "high",
      priorityConfidence: 0.8,
      labels: [{ id: "l1", name: "bug", color: "purple", probability: 0.9 }],
    });
    const asked = JSON.stringify(askedQuestions);
    expect(asked).toContain("kaneo");
    expect(asked).toContain("Private Projects: Dev");
  });

  it("returns null when Jev is not configured", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");

    const result = await qualifyTask({ projectId: "p1", title: "Fix login" });

    expect(result).toBeNull();
  });

  it("rejects an unknown project", async () => {
    mockSelect.mockImplementation(() => ({ from: missingProjectChain }));

    await expect(
      qualifyTask({ projectId: "nope", title: "Fix login" }),
    ).rejects.toThrow("Project not found");
  });
});
