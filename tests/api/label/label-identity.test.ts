import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

const mockFindFirst = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockPublishEvent = vi.fn();
const mockSyncLabelToGitHub = vi.fn();
const mockSyncLabelToGitea = vi.fn();

function makeSelectMock(rows: unknown[]) {
  const chain: Record<string, Mock> = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
  };
  return chain;
}

function makeUpdateMock(returningRows: unknown[]) {
  const build = (withReturning: boolean) => {
    const set = vi.fn(() => {
      const whereResult = Object.assign(Promise.resolve(undefined), {
        ...(withReturning
          ? { returning: vi.fn(() => Promise.resolve(returningRows)) }
          : {}),
      });
      return { where: vi.fn(() => whereResult) };
    });
    return { set };
  };
  const main = build(true);
  const cascade = build(false);
  let call = 0;
  mockUpdate.mockImplementation(() => (call++ === 0 ? main : cascade));
  return { main, cascade };
}

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: {
      labelTable: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    transaction: async (callback: (tx: unknown) => unknown) =>
      callback({
        query: {
          labelTable: {
            findFirst: (...args: unknown[]) => mockFindFirst(...args),
          },
        },
        select: (...args: unknown[]) => mockSelect(...args),
        update: (...args: unknown[]) => mockUpdate(...args),
      }),
  },
}));

vi.mock("../../../apps/api/src/events", () => ({
  publishEvent: (...args: unknown[]) => mockPublishEvent(...args),
}));

vi.mock(
  "../../../apps/api/src/plugins/github/utils/sync-label-to-github",
  () => ({
    syncLabelToGitHub: (...args: unknown[]) => mockSyncLabelToGitHub(...args),
  }),
);

vi.mock(
  "../../../apps/api/src/plugins/gitea/utils/sync-label-to-gitea",
  () => ({
    syncLabelToGitea: (...args: unknown[]) => mockSyncLabelToGitea(...args),
  }),
);

import createLabel from "../../../apps/api/src/label/controllers/create-label";
import updateLabel from "../../../apps/api/src/label/controllers/update-label";

const DEFINITION = {
  id: "label-def-1",
  name: "API",
  color: "teal",
  createdAt: new Date(),
  updatedAt: new Date(),
  taskId: null,
  workspaceId: "ws-1",
};

const TASK = {
  id: "task-1",
  projectId: "proj-1",
  workspaceId: "ws-1",
};

describe("createLabel (task-scoped copy)", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockSelect.mockReset();
    mockInsert.mockReset();
    mockUpdate.mockReset();
    mockPublishEvent.mockReset();
    mockSyncLabelToGitHub.mockReset().mockResolvedValue(undefined);
    mockSyncLabelToGitea.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mirrors the workspace definition's color instead of the requested one", async () => {
    mockSelect
      .mockImplementationOnce(() => makeSelectMock([TASK]))
      .mockImplementationOnce(() => makeSelectMock([DEFINITION]));

    const values = vi.fn(() => {
      const onConflictResult = Object.assign(Promise.resolve(undefined), {
        returning: vi.fn(() =>
          Promise.resolve([
            {
              id: "label-copy-1",
              name: "API",
              color: "teal",
              taskId: "task-1",
              workspaceId: "ws-1",
            },
          ]),
        ),
      });
      return { onConflictDoNothing: vi.fn(() => onConflictResult) };
    });
    mockInsert.mockImplementation(() => ({ values }));

    const label = await createLabel(
      "API",
      "#0D9488",
      "task-1",
      "ws-1",
      "user-1",
    );

    expect(label.color).toBe("teal");
    expect(values).toHaveBeenCalledWith({
      name: "API",
      color: "teal",
      taskId: "task-1",
      workspaceId: "ws-1",
    });
  });

  it("keeps the requested color when no workspace definition exists", async () => {
    mockSelect
      .mockImplementationOnce(() => makeSelectMock([TASK]))
      .mockImplementationOnce(() => makeSelectMock([]));

    const values = vi.fn(() => {
      const onConflictResult = Object.assign(Promise.resolve(undefined), {
        returning: vi.fn(() =>
          Promise.resolve([
            {
              id: "label-copy-2",
              name: "API",
              color: "#0D9488",
              taskId: "task-1",
              workspaceId: "ws-1",
            },
          ]),
        ),
      });
      return { onConflictDoNothing: vi.fn(() => onConflictResult) };
    });
    mockInsert.mockImplementation(() => ({ values }));

    const label = await createLabel(
      "API",
      "#0D9488",
      "task-1",
      "ws-1",
      "user-1",
    );

    expect(label.color).toBe("#0D9488");
  });
});

describe("updateLabel", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockSelect.mockReset();
    mockInsert.mockReset();
    mockUpdate.mockReset();
    mockPublishEvent.mockReset();
    mockSyncLabelToGitHub.mockReset().mockResolvedValue(undefined);
    mockSyncLabelToGitea.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a workspace rename that collides with another definition", async () => {
    mockFindFirst.mockResolvedValue({
      id: "label-def-1",
      name: "UI/UX",
      color: "purple",
      createdAt: new Date(),
      updatedAt: new Date(),
      taskId: null,
      workspaceId: "ws-1",
    });
    mockSelect.mockImplementationOnce(() =>
      makeSelectMock([{ id: "label-def-2" }]),
    );

    await expect(
      updateLabel("label-def-1", "API", "purple"),
    ).rejects.toMatchObject({
      status: 400,
      message: "A label with this name already exists in this workspace",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("renames a task copy onto an existing definition with the definition's color", async () => {
    mockFindFirst.mockResolvedValue({
      id: "label-copy-1",
      name: "bug",
      color: "red",
      createdAt: new Date(),
      updatedAt: new Date(),
      taskId: "task-1",
      workspaceId: "ws-1",
    });
    mockSelect.mockImplementationOnce(() => makeSelectMock([DEFINITION]));

    const { main } = makeUpdateMock([
      {
        id: "label-copy-1",
        name: "API",
        color: "teal",
        createdAt: new Date(),
        updatedAt: new Date(),
        taskId: "task-1",
        workspaceId: "ws-1",
      },
    ]);

    const updated = await updateLabel("label-copy-1", "API", "#0D9488");

    expect(updated.color).toBe("teal");
    expect(main.set).toHaveBeenCalledWith({ name: "API", color: "teal" });
  });
});
