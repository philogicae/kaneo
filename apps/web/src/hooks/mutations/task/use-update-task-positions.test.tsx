import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import updateTask from "@/fetchers/task/update-task";
import type Task from "@/types/task";
import { useUpdateTaskPositions } from "./use-update-task-positions";

vi.mock("@/fetchers/task/update-task", () => ({ default: vi.fn() }));

function makeTask(id: string): Task {
  return {
    id,
    title: id,
    number: 1,
    description: null,
    status: "to-do",
    priority: null,
    startDate: null,
    dueDate: null,
    position: 0,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "project-1",
  };
}

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  vi.clearAllMocks();
});

afterEach(() => queryClient.clear());

describe("useUpdateTaskPositions", () => {
  it("serializes overlapping drops so writes keep their order", async () => {
    let releaseFirst!: () => void;
    vi.mocked(updateTask)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = () =>
              resolve({} as Awaited<ReturnType<typeof updateTask>>);
          }),
      )
      .mockResolvedValueOnce({} as Awaited<ReturnType<typeof updateTask>>);

    const { result } = renderHook(() => useUpdateTaskPositions(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({
        projectId: "project-1",
        tasks: [makeTask("first")],
      });
      result.current.mutate({
        projectId: "project-1",
        tasks: [makeTask("second")],
      });
    });

    await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(1));
    releaseFirst();
    await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(2));
    expect(vi.mocked(updateTask).mock.calls.map(([id]) => id)).toEqual([
      "first",
      "second",
    ]);
  });
});
