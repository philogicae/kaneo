import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("../../apps/api/src/database", () => ({
  default: {
    query: {
      columnTable: {
        findFirst: async () => ({ id: "column-1", slug: "to-do" }),
      },
    },
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock("../../apps/api/src/events", () => ({
  publishEvent: () => {},
}));

vi.mock("../../apps/api/src/utils/assert-assignable-user", () => ({
  assertAssignableUser: async () => {},
  getProjectWorkspaceId: async () => "workspace-1",
}));

vi.mock("../../apps/api/src/storage/cleanup-assets", () => ({
  deleteOrphanedAssets: async () => {},
}));

const { default: updateTask } = await import(
  "../../apps/api/src/task/controllers/update-task"
);

const EXISTING_TASK = {
  id: "task-1",
  description: "desc",
  status: "to-do",
  projectId: "project-1",
  startDate: null,
  dueDate: null,
  reminderOffsets: null,
};

function chainUpdate(returned: Record<string, unknown>) {
  // Drizzle's builder: update(table).set(values).where(condition).returning()
  const set = vi.fn(() => ({
    where: () => ({
      returning: async () => [returned],
    }),
  }));
  mockUpdate.mockReturnValue({ set });
  return set;
}

beforeEach(() => {
  mockSelect.mockReset();
  mockUpdate.mockReset();
  mockDelete.mockReset();
  mockSelect.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => [EXISTING_TASK],
        // getValidTaskStatuses chains .orderBy on the same select builder.
        orderBy: async () => [{ slug: "to-do" }],
      }),
    }),
  });
  mockDelete.mockReturnValue({ where: async () => {} });
});

describe("updateTask config clearing", () => {
  it("clears a leftover recurrence when recurrence is explicitly null", async () => {
    const set = chainUpdate({ ...EXISTING_TASK, recurrence: null });

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

    const values = set.mock.calls[0][0] as Record<string, unknown>;
    expect(values).toHaveProperty("recurrence", null);
  });

  it("resets sent-reminder history when reminderOffsets change", async () => {
    // Existing task already carries reminders, so the new null is a change.
    mockSelect.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [{ ...EXISTING_TASK, reminderOffsets: [60] }],
          orderBy: async () => [{ slug: "to-do" }],
        }),
      }),
    });
    const set = chainUpdate({ ...EXISTING_TASK, reminderOffsets: null });

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

    const values = set.mock.calls[0][0] as Record<string, unknown>;
    expect(values).toHaveProperty("reminderOffsets", null);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("keeps config untouched when fields are omitted", async () => {
    const set = chainUpdate({ ...EXISTING_TASK });

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

    const values = set.mock.calls[0][0] as Record<string, unknown>;
    expect(values).not.toHaveProperty("recurrence");
    expect(values).not.toHaveProperty("reminderOffsets");
  });
});
