import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import getCustomFieldValuesByProject from "@/fetchers/custom-field/get-custom-field-values-by-project";
import type Task from "@/types/task";
import { useTaskFiltersWithLabelsSupport } from "./use-task-view-filters";

vi.mock("@/fetchers/custom-field/get-custom-field-values-by-project");
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US", resolvedLanguage: "en-US" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const task: Task = {
  id: "unopened-task",
  title: "Unopened task",
  projectId: "project-1",
  number: 1,
  description: null,
  status: "to-do",
  priority: "high",
  position: 0,
  createdAt: "2026-10-01T00:00:00Z",
  startDate: null,
  dueDate: null,
  userId: null,
  assigneeId: null,
  assigneeName: null,
  labels: [],
};

const otherTask: Task = {
  ...task,
  id: "other-task",
  number: 2,
  title: "Other task",
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.resetAllMocks();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("custom-field filters with project values", () => {
  it("does not fetch project values without a custom-field filter", () => {
    const { result } = renderHook(
      () => useTaskFiltersWithLabelsSupport(null, "project-1"),
      { wrapper: createWrapper() },
    );

    expect(result.current.filterTasks([task])).toEqual([task]);
    expect(result.current.customFieldValues.isLoading).toBe(false);
    expect(getCustomFieldValuesByProject).not.toHaveBeenCalled();
  });

  it("matches an unopened task once its project values arrive", async () => {
    window.localStorage.setItem(
      "kaneo:board-filters:project-1",
      JSON.stringify({ customFields: { size: ["L"] } }),
    );
    let resolve!: (
      values: Awaited<ReturnType<typeof getCustomFieldValuesByProject>>,
    ) => void;
    const pending = new Promise<
      Awaited<ReturnType<typeof getCustomFieldValuesByProject>>
    >((done) => {
      resolve = done;
    });
    vi.mocked(getCustomFieldValuesByProject).mockReturnValue(pending);

    const { result } = renderHook(
      () => useTaskFiltersWithLabelsSupport(null, "project-1"),
      { wrapper: createWrapper() },
    );

    // Unknown values are not an empty value on every task.
    expect(result.current.filterTasks([task, otherTask])).toEqual([
      task,
      otherTask,
    ]);
    expect(result.current.customFieldValues.isLoading).toBe(true);

    resolve([
      {
        id: "value-1",
        taskId: task.id,
        fieldId: "size",
        value: "L",
        fieldName: "Size",
        fieldPosition: 0,
        fieldType: "dropdown",
        fieldOptions: ["S", "L"],
      },
    ]);

    await waitFor(() =>
      expect(result.current.filterTasks([task, otherTask])).toEqual([task]),
    );
    expect(result.current.customFieldValues.isLoading).toBe(false);
  });
});
