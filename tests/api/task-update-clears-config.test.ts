import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { state } = vi.hoisted(() => ({
  state: {
    // Rows the controller reads, in call order: the task as read before the
    // write, the project's valid statuses, the project itself, then the task
    // re-read under the transaction.
    taskRows: [] as unknown[],
    statuses: [] as unknown[],
    projectRows: [] as unknown[],
    updateValues: [] as Record<string, unknown>[],
    deletes: 0,
  },
}));

vi.mock("../../apps/api/src/database", () => {
  // Every builder resolves to an awaitable that also carries `.limit()` and
  // `.orderBy()`, because the controller awaits some reads directly and chains
  // those two helpers on others.
  const rows = (values: unknown[]) =>
    Object.assign(Promise.resolve(values), {
      limit: async () => values,
      orderBy: async () => values,
    });

  // The controller's reads are told apart by what they project: the project's
  // valid statuses, the project row itself, or the task.
  const select = (fields?: Record<string, unknown>) => {
    const projected = fields ? Object.keys(fields) : [];
    const values = projected.includes("slug")
      ? state.statuses
      : projected.length === 1 && projected[0] === "id"
        ? state.projectRows
        : state.taskRows;
    return { from: () => ({ where: () => rows(values) }) };
  };
  const update = () => ({
    set: (values: Record<string, unknown>) => {
      state.updateValues.push(values);
      return {
        where: () => ({
          returning: async () => [{ id: "task-1", ...values }],
        }),
      };
    },
  });
  const del = () => ({
    where: async () => {
      state.deletes += 1;
    },
  });

  // The controller writes inside one transaction, so the transaction handle has
  // to offer the same builders as the module-level client.
  const transaction = {
    query: {
      columnTable: {
        findFirst: async () => ({ id: "column-1", slug: "to-do" }),
      },
    },
    select: () => {
      // The in-transaction reads continue the same sequence.
      return select();
    },
    update,
    delete: del,
    insert: () => ({ values: async () => undefined }),
  };

  return {
    default: {
      ...transaction,
      // `assertValidTaskStatus` and the task pre-read share the module client.
      select,
      transaction: async (run: (tx: unknown) => Promise<unknown>) =>
        run(transaction),
    },
  };
});

vi.mock("../../apps/api/src/events", () => ({
  publishEvent: () => {},
}));

vi.mock("../../apps/api/src/utils/assert-assignable-user", () => ({
  assertAssignableUser: async () => {},
}));

vi.mock("../../apps/api/src/storage/cleanup-assets", () => ({
  deleteOrphanedAssets: async () => {},
}));

vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  () => ({
    createNotification: async () => undefined,
  }),
);

const { default: updateTask } =
  await import("../../apps/api/src/task/controllers/update-task");

const EXISTING_TASK = {
  id: "task-1",
  description: "desc",
  status: "to-do",
  projectId: "project-1",
  startDate: null,
  dueDate: null,
  reminderOffsets: null,
};

function seed(existing: Record<string, unknown> = EXISTING_TASK) {
  state.taskRows = [existing];
  state.statuses = [{ slug: "to-do" }];
  state.projectRows = [{ id: "project-1" }];
}

beforeEach(() => {
  seed();
  state.updateValues = [];
  state.deletes = 0;
});

describe("updateTask config clearing", () => {
  it("clears a leftover recurrence when recurrence is explicitly null", async () => {
    await updateTask(
      "task-1",
      "Task",
      "to-do",
      undefined,
      undefined,
      "project-1",
      "desc",
      "medium",
      0,
      undefined,
      "user-1",
      undefined,
      null,
    );

    expect(state.updateValues[0]).toHaveProperty("recurrence", null);
  });

  it("resets sent-reminder history when reminderOffsets change", async () => {
    // Existing task already carries reminders, so the new null is a change.
    seed({ ...EXISTING_TASK, reminderOffsets: [60] });

    await updateTask(
      "task-1",
      "Task",
      "to-do",
      undefined,
      undefined,
      "project-1",
      "desc",
      "medium",
      0,
      undefined,
      "user-1",
      null,
      undefined,
    );

    expect(state.updateValues[0]).toHaveProperty("reminderOffsets", null);
    expect(state.deletes).toBeGreaterThan(0);
  });

  it("resets sent-reminder history when the start date moves without reminderOffsets", async () => {
    seed({
      ...EXISTING_TASK,
      startDate: new Date("2026-09-20T10:00:00Z"),
      reminderOffsets: [60],
    });

    await updateTask(
      "task-1",
      "Task",
      "to-do",
      new Date("2026-09-21T10:00:00Z"),
      undefined,
      "project-1",
      "desc",
      "medium",
      0,
      undefined,
      "user-1",
      undefined,
      undefined,
    );

    expect(state.updateValues[0]).not.toHaveProperty("reminderOffsets");
    expect(state.deletes).toBeGreaterThan(0);
  });

  it("keeps config untouched when fields are omitted", async () => {
    await updateTask(
      "task-1",
      "Task",
      "to-do",
      undefined,
      undefined,
      "project-1",
      "desc",
      "medium",
      0,
      undefined,
      "user-1",
      undefined,
      undefined,
    );

    expect(state.updateValues[0]).not.toHaveProperty("recurrence");
    expect(state.updateValues[0]).not.toHaveProperty("reminderOffsets");
    expect(state.deletes).toBe(0);
  });
});
