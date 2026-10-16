import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vite-plus/test";

const mockFindFirst = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockPublishEvent = vi.fn();
const mockRemoveLabelFromGitHub = vi.fn();
const mockRemoveLabelFromGitea = vi.fn();
const mockRemoveLabelFromGitlab = vi.fn();

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: {
      labelTable: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

// The controller serialises deletion through a lease; the mocked database only
// has to satisfy the lease module's `run` entry point.
vi.mock("../../../apps/api/src/database/lease", () => ({
  withLease: (_key: string, run: () => Promise<unknown>) => run(),
}));

vi.mock("../../../apps/api/src/events", () => ({
  publishEvent: (...args: unknown[]) => mockPublishEvent(...args),
}));

vi.mock(
  "../../../apps/api/src/plugins/github/utils/sync-label-to-github",
  () => ({
    removeLabelFromGitHub: (...args: unknown[]) =>
      mockRemoveLabelFromGitHub(...args),
  }),
);

vi.mock(
  "../../../apps/api/src/plugins/gitea/utils/sync-label-to-gitea",
  () => ({
    removeLabelFromGitea: (...args: unknown[]) =>
      mockRemoveLabelFromGitea(...args),
  }),
);

vi.mock(
  "../../../apps/api/src/plugins/gitlab/utils/sync-label-to-gitlab",
  () => ({
    removeLabelFromGitlab: (...args: unknown[]) =>
      mockRemoveLabelFromGitlab(...args),
  }),
);

import deleteLabel from "../../../apps/api/src/label/controllers/delete-label";

const WORKSPACE_LABEL = {
  id: "label-ws-1",
  name: "bug",
  color: "EF4444",
  createdAt: new Date(),
  updatedAt: new Date(),
  taskId: null,
  workspaceId: "ws-1",
};

const DELETED_WORKSPACE_LABEL = { ...WORKSPACE_LABEL };

const TASK_LABEL_1 = {
  id: "label-task-1",
  name: "bug",
  color: "EF4444",
  createdAt: new Date(),
  updatedAt: new Date(),
  taskId: "task-1",
  workspaceId: "ws-1",
};

const TASK_LABEL_2 = {
  id: "label-task-2",
  name: "bug",
  color: "EF4444",
  createdAt: new Date(),
  updatedAt: new Date(),
  taskId: "task-2",
  workspaceId: "ws-1",
};

/**
 * `db.select(...).from(...).innerJoin(...).where(...).limit(n)` resolves to the
 * given rows. The controller issues two different selects: the snapshot batch
 * (a list of `{ id }`) and, per deleted task label, the owning task.
 */
function makeSelectMock(rows: unknown[]) {
  const chain: Record<string, Mock> = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
    orderBy: vi.fn(() => chain),
  };
  return chain;
}

/**
 * Chain for the sync notification select, which awaits
 * `select().from().innerJoin().where()` directly.
 */
function makeAwaitSelectMock(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  // oxlint-disable-next-line unicorn/no-thenable -- the controller awaits this select chain directly.
  chain.then = (onFulfilled: (rows: unknown) => unknown) =>
    Promise.resolve(rows).then(onFulfilled);
  return chain;
}

/** Chain for the snapshot batch select, which resolves without `.limit()`. */
function makeBatchSelectMock(rows: unknown[]) {
  const chain: Record<string, Mock> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(rows));
  return chain;
}

/**
 * Chain for `db.delete().where().returning()`: `.where()` yields a thenable
 * sub-chain carrying `.returning()`.
 */
function makeDeleteMock(deletedRow: unknown) {
  const whereResult = Object.assign(Promise.resolve(undefined), {
    returning: vi.fn(() => Promise.resolve([deletedRow])),
  });
  return { where: vi.fn(() => whereResult) };
}

/** Chain for `db.update().set().where().returning()`, used for the root row. */
function makeUpdateMock(updatedRow: unknown) {
  const chain: Record<string, Mock> = {
    set: vi.fn(() => chain),
    where: vi.fn(() => ({
      returning: vi.fn(() => Promise.resolve([updatedRow])),
    })),
  };
  return chain;
}

describe("deleteLabel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRemoveLabelFromGitlab.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("workspace-level label deletion (taskId is null)", () => {
    it("emits task.label_deleted events for each affected task-level label", async () => {
      mockRemoveLabelFromGitHub.mockResolvedValue(undefined);
      mockRemoveLabelFromGitea.mockResolvedValue(undefined);
      mockFindFirst.mockResolvedValue(WORKSPACE_LABEL);
      mockUpdate.mockReturnValue(makeUpdateMock(WORKSPACE_LABEL));
      // Sync notification: no active integrations for this workspace.
      mockSelect.mockReturnValueOnce(makeAwaitSelectMock([]));
      // Snapshot batch: both task-level copies share the workspace label's name.
      mockSelect.mockReturnValueOnce(
        makeBatchSelectMock([{ id: "label-task-1" }, { id: "label-task-2" }]),
      );
      // One owning-task select per deleted copy.
      mockSelect
        .mockReturnValueOnce(
          makeSelectMock([
            {
              id: "task-1",
              projectId: "proj-1",
              workspaceId: "ws-1",
            },
          ]),
        )
        .mockReturnValueOnce(
          makeSelectMock([
            {
              id: "task-2",
              projectId: "proj-2",
              workspaceId: "ws-1",
            },
          ]),
        );
      mockDelete
        .mockReturnValueOnce(makeDeleteMock(TASK_LABEL_1))
        .mockReturnValueOnce(makeDeleteMock(TASK_LABEL_2))
        .mockReturnValue(makeDeleteMock(DELETED_WORKSPACE_LABEL));

      await deleteLabel("label-ws-1", "user-1");

      expect(mockPublishEvent).toHaveBeenCalledTimes(2);
      expect(mockPublishEvent).toHaveBeenCalledWith(
        "task.label_deleted",
        {
          label: TASK_LABEL_1,
          task: { id: "task-1", projectId: "proj-1", workspaceId: "ws-1" },
          projectId: "proj-1",
          taskId: "task-1",
          userId: "user-1",
          type: "label_deleted",
        },
        { waitForHandlers: true },
      );
      expect(mockPublishEvent).toHaveBeenCalledWith(
        "task.label_deleted",
        {
          label: TASK_LABEL_2,
          task: { id: "task-2", projectId: "proj-2", workspaceId: "ws-1" },
          projectId: "proj-2",
          taskId: "task-2",
          userId: "user-1",
          type: "label_deleted",
        },
        { waitForHandlers: true },
      );
    });

    it("calls removeLabelFromGitHub, removeLabelFromGitea and removeLabelFromGitlab for each affected task", async () => {
      mockRemoveLabelFromGitHub.mockResolvedValue(undefined);
      mockRemoveLabelFromGitea.mockResolvedValue(undefined);
      mockFindFirst.mockResolvedValue(WORKSPACE_LABEL);
      mockUpdate.mockReturnValue(makeUpdateMock(WORKSPACE_LABEL));
      mockSelect.mockReturnValueOnce(makeAwaitSelectMock([]));
      mockSelect.mockReturnValueOnce(
        makeBatchSelectMock([{ id: "label-task-1" }]),
      );
      mockSelect.mockReturnValueOnce(
        makeSelectMock([
          { id: "task-1", projectId: "proj-1", workspaceId: "ws-1" },
        ]),
      );
      mockDelete.mockReturnValueOnce(makeDeleteMock(TASK_LABEL_1));
      mockDelete.mockReturnValue(makeDeleteMock(DELETED_WORKSPACE_LABEL));

      await deleteLabel("label-ws-1", "user-1");

      expect(mockRemoveLabelFromGitHub).toHaveBeenCalledWith("task-1", "bug");
      expect(mockRemoveLabelFromGitea).toHaveBeenCalledWith("task-1", "bug");
      expect(mockRemoveLabelFromGitlab).toHaveBeenCalledWith("task-1", "bug");
    });

    it("fires no events when no task-level labels are affected", async () => {
      mockRemoveLabelFromGitHub.mockResolvedValue(undefined);
      mockRemoveLabelFromGitea.mockResolvedValue(undefined);
      mockFindFirst.mockResolvedValue(WORKSPACE_LABEL);
      mockUpdate.mockReturnValue(makeUpdateMock(WORKSPACE_LABEL));
      mockSelect
        .mockReturnValueOnce(makeAwaitSelectMock([]))
        .mockReturnValue(makeBatchSelectMock([]));
      mockDelete.mockReturnValue(makeDeleteMock(DELETED_WORKSPACE_LABEL));

      await deleteLabel("label-ws-1", "user-1");

      expect(mockPublishEvent).not.toHaveBeenCalled();
      expect(mockRemoveLabelFromGitHub).not.toHaveBeenCalled();
    });

    it("records the snapshot boundary before deleting anything", async () => {
      mockFindFirst.mockResolvedValue(WORKSPACE_LABEL);
      mockUpdate.mockReturnValue(makeUpdateMock(WORKSPACE_LABEL));
      mockSelect
        .mockReturnValueOnce(makeAwaitSelectMock([]))
        .mockReturnValue(makeBatchSelectMock([]));
      mockDelete.mockReturnValue(makeDeleteMock(DELETED_WORKSPACE_LABEL));

      await deleteLabel("label-ws-1", "user-1");

      expect(mockUpdate).toHaveBeenCalledWith(expect.anything());
      expect(mockUpdate.mock.results[0]?.value.set).toHaveBeenCalled();
    });
  });
});
