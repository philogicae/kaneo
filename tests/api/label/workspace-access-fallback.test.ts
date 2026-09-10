import { beforeEach, describe, expect, it, vi } from "vitest";

// The middleware makes at most two ordered lookups per source list; the label
// lookup runs first, then the task fallback.
const mocks = vi.hoisted(() => {
  const labelRows: Record<string, unknown>[] = [];
  const taskRows: Record<string, unknown>[] = [];
  let callIndex = 0;
  const resolveRows = () => (callIndex++ === 0 ? labelRows : taskRows);
  return {
    labelRows,
    taskRows,
    reset: () => {
      labelRows.length = 0;
      taskRows.length = 0;
      callIndex = 0;
    },
    db: {
      select: vi.fn(() => ({
        from: () => {
          const where = () => ({
            limit: async () => resolveRows(),
          });
          return { where, innerJoin: () => ({ where }) };
        },
      })),
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

function makeContext(body: Record<string, unknown>) {
  return {
    get: (key: string) => (key === "userId" ? "user-1" : undefined),
    set: vi.fn(),
    req: {
      param: (key: string) => (key === "id" ? "label-1" : undefined),
      query: () => undefined,
      json: async () => body,
    },
  };
}

async function runFromLabel(body: Record<string, unknown>) {
  const next = vi.fn();
  await workspaceAccess.fromLabel()(makeContext(body) as never, next);
  return mocks.validatedWorkspaceId.value;
}

describe("workspaceAccess.fromLabel", () => {
  beforeEach(() => {
    mocks.reset();
  });

  it("authorizes against the label's own workspace", async () => {
    mocks.labelRows.push({ workspaceId: "ws-1" });
    expect(await runFromLabel({ taskId: "task-1" })).toBe("ws-1");
  });

  it("falls back to the task's workspace when the label has none", async () => {
    mocks.taskRows.push({ workspaceId: "ws-2" });
    expect(await runFromLabel({ taskId: "task-1" })).toBe("ws-2");
  });

  it("fails closed when neither label nor task resolves a workspace", async () => {
    await expect(runFromLabel({ taskId: "task-1" })).rejects.toThrow(
      /Workspace ID could not be determined/,
    );
  });
});
