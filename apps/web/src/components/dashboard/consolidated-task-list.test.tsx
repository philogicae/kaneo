import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConsolidatedProject } from "./consolidated-task-list";
import ConsolidatedTaskList from "./consolidated-task-list";

const getTasks = vi.fn();
const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === "unified:consolidated.taskNumber") {
        return `#${options?.number}`;
      }
      if (key === "unified:consolidated.backlogCount") {
        return `${options?.count} backlog`;
      }
      if (key === "unified:consolidated.tasksCount") {
        return `${options?.count} tasks`;
      }
      return key;
    },
  }),
}));

vi.mock("@/fetchers/task/get-tasks", () => ({
  default: (...args: unknown[]) => getTasks(...(args as [string])),
}));

function boardResponse(overrides?: {
  columns?: Array<{
    id: string;
    name: string;
    isFinal?: boolean;
    tasks: Array<Record<string, unknown>>;
  }>;
  plannedTasks?: Array<Record<string, unknown>>;
}) {
  return {
    columns: overrides?.columns ?? [
      {
        id: "col-1",
        name: "To Do",
        isFinal: false,
        tasks: [task("t-1", "First task")],
      },
      {
        id: "col-2",
        name: "Done",
        isFinal: true,
        tasks: [task("t-2", "Shipped task")],
      },
    ],
    archivedTasks: [],
    plannedTasks: overrides?.plannedTasks ?? [
      task("p-1", "Planned work"),
      task("p-2", "Later work"),
    ],
  };
}

function task(id: string, title: string) {
  return {
    id,
    title,
    number: 42,
    description: null,
    status: "to-do",
    priority: "high",
    startDate: null,
    dueDate: null,
    position: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    userId: null,
    assigneeId: null,
    assigneeName: "Ada Lovelace",
    projectId: "project-1",
  };
}

function project(id = "project-1"): ConsolidatedProject {
  // Only the fields the component reads are populated; the shape comes from
  // the API response type.
  return {
    workspaceId: "ws-1",
    workspaceName: "Dev",
    project: {
      id,
      name: `Project ${id}`,
      icon: "Layout",
      statistics: { totalTasks: 2, plannedTasks: 2, completionPercentage: 0 },
    },
  } as unknown as ConsolidatedProject;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("ConsolidatedTaskList", () => {
  it("renders backlog tasks grouped per project", async () => {
    getTasks.mockResolvedValue(boardResponse());

    render(<ConsolidatedTaskList projects={[project()]} mode="backlog" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Planned work")).toBeVisible();
    });
    expect(screen.getByText("Later work")).toBeVisible();
    // Board tasks (to-do/done) must not leak into the backlog view.
    expect(screen.queryByText("First task")).toBeNull();
    expect(screen.getByText("2 backlog")).toBeVisible();
  });

  it("renders active board tasks with their column name", async () => {
    getTasks.mockResolvedValue(boardResponse());

    render(<ConsolidatedTaskList projects={[project()]} mode="tasks" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("First task")).toBeVisible();
    });
    expect(screen.getByText("Shipped task")).toBeVisible();
    expect(screen.getByText("To Do")).toBeVisible();
    expect(screen.getByText("Done")).toBeVisible();
    // Planned tasks are backlog, not active tasks.
    expect(screen.queryByText("Planned work")).toBeNull();
  });

  it("shows the empty state when no backlog task exists", async () => {
    getTasks.mockResolvedValue(
      boardResponse({ columns: [], plannedTasks: [] }),
    );

    render(<ConsolidatedTaskList projects={[project()]} mode="backlog" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("unified:empty.backlogTitle")).toBeVisible();
    });
  });

  it("requests each project's board once and navigates to the task detail page", async () => {
    getTasks.mockResolvedValue(boardResponse());

    render(
      <ConsolidatedTaskList
        projects={[project("project-1"), project("project-2")]}
        mode="tasks"
      />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText("Project project-2")).toBeVisible();
    });
    expect(getTasks).toHaveBeenCalledWith("project-1");
    expect(getTasks).toHaveBeenCalledWith("project-2");

    const row = screen.getAllByText("First task")[0].closest("button");
    expect(row).not.toBeNull();
    row?.click();
    expect(navigate).toHaveBeenCalledWith({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: {
        workspaceId: "ws-1",
        projectId: "project-1",
        taskId: "t-1",
      },
    });
  });

  it("groups project cards under their workspace heading", async () => {
    getTasks.mockResolvedValue(boardResponse());

    render(
      <ConsolidatedTaskList
        projects={[
          {
            ...project("project-1"),
            workspaceId: "ws-1",
            workspaceName: "Dev",
          },
          {
            ...project("project-2"),
            workspaceId: "ws-2",
            workspaceName: "Ops",
          },
        ]}
        mode="tasks"
      />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText("Project project-2")).toBeVisible();
    });
    expect(screen.getByRole("heading", { name: "Dev" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Ops" })).toBeVisible();
  });

  it("hides workspace sections without matching tasks", async () => {
    getTasks.mockImplementation(async (projectId: string) =>
      projectId === "project-1"
        ? boardResponse()
        : { columns: [], plannedTasks: [] },
    );

    render(
      <ConsolidatedTaskList
        projects={[project("project-1"), project("project-2")]}
        mode="tasks"
      />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText("Project project-1")).toBeVisible();
    });
    expect(screen.queryByText("Project project-2")).toBeNull();
    // Both fixtures share one workspace; project-2 has no tasks, so exactly
    // one workspace heading remains.
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });
});
