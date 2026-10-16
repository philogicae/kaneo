import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

// The label lookup joins its task and project, so one read resolves the
// workspace of both a workspace-level label and a task-scoped copy.
const mocks = vi.hoisted(() => {
  const labelRows: Record<string, unknown>[] = [];
  return {
    labelRows,
    reset: () => {
      labelRows.length = 0;
    },
    db: {
      // Every join returns the same chain, so the two left joins the label
      // lookup issues compose.
      select: vi.fn(() => {
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.innerJoin = () => chain;
        chain.leftJoin = () => chain;
        chain.where = () => chain;
        chain.limit = async () => mocks.labelRows;
        return chain;
      }),
    },
    validatedWorkspaceId: new (class {
      value?: string;
    })(),
  };
});

vi.mock("../../../apps/api/src/database", async (importOriginal) => ({
  ...(await importOriginal()),
  default: mocks.db,
}));

vi.mock("../../../apps/api/src/utils/validate-workspace-access", () => ({
  validateWorkspaceAccess: vi.fn(
    async (_userId: string, workspaceId: string) => {
      mocks.validatedWorkspaceId.value = workspaceId;
    },
  ),
}));

import { workspaceAccess } from "../../../apps/api/src/utils/workspace-access-middleware";

function makeContext() {
  return {
    get: (key: string) => (key === "userId" ? "user-1" : undefined),
    set: vi.fn(),
    req: {
      param: (key: string) => (key === "id" ? "label-1" : undefined),
      query: () => undefined,
      json: async () => ({}),
    },
  };
}

async function runFromLabel() {
  const next = vi.fn();
  await workspaceAccess.fromLabel()(makeContext() as never, next);
  return mocks.validatedWorkspaceId.value;
}

describe("workspaceAccess.fromLabel", () => {
  beforeEach(() => {
    mocks.reset();
  });

  it("authorizes against the label's own workspace", async () => {
    mocks.labelRows.push({
      workspaceId: "ws-1",
      taskId: null,
      taskWorkspaceId: null,
      taskProjectId: null,
    });
    expect(await runFromLabel()).toBe("ws-1");
  });

  it("resolves a task-scoped copy through its task when the label has none", async () => {
    mocks.labelRows.push({
      workspaceId: null,
      taskId: "task-1",
      taskWorkspaceId: "ws-2",
      taskProjectId: "project-2",
    });
    expect(await runFromLabel()).toBe("ws-2");
  });

  it("answers a label whose task is in another workspace like a missing one", async () => {
    mocks.labelRows.push({
      workspaceId: "ws-1",
      taskId: "task-1",
      taskWorkspaceId: "ws-2",
      taskProjectId: "project-2",
    });
    await expect(runFromLabel()).rejects.toThrow(/Label not found/);
  });

  it("answers a missing label with not found", async () => {
    await expect(runFromLabel()).rejects.toThrow(/Label not found/);
  });
});
