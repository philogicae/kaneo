import type { client } from "@kaneo/libs";
import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import type { InferResponseType } from "hono/client";
import { Inbox, ListChecks } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TaskLabels } from "@/components/kanban-board/task-labels";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  CardFrame,
  CardFrameHeader,
  CardFrameTitle,
  CardPanel,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import icons from "@/constants/project-icons";
import getTasks from "@/fetchers/task/get-tasks";
import { cn } from "@/lib/cn";
import { dueDateStatusColors, getDueDateStatus } from "@/lib/due-date-status";
import { getInitials } from "@/lib/get-initials";
import { getPriorityIcon } from "@/lib/priority";
import type Task from "@/types/task";

type ProjectListItem = InferResponseType<
  (typeof client)["project"]["$get"],
  200
>[number];

export type ConsolidatedProject = {
  workspaceId: string;
  workspaceName: string;
  project: ProjectListItem;
};

export type ConsolidatedMode = "backlog" | "tasks";

type ConsolidatedTask = Task & {
  columnName?: string | null;
  columnIsFinal?: boolean;
};

// A cross-project view cannot reuse the project-scoped list rows (they bind to
// the project store and drag & drop); a read-only row keeps this surface
// cheap: open the task's detail page, nothing more.
function ConsolidatedTaskRow({
  task,
  project,
}: {
  task: ConsolidatedTask;
  project: ConsolidatedProject;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dueStatus = getDueDateStatus(task.dueDate, task.columnIsFinal);

  return (
    <button
      type="button"
      className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/40"
      onClick={() =>
        navigate({
          to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
          params: {
            workspaceId: project.workspaceId,
            projectId: project.project.id,
            taskId: task.id,
          },
        })
      }
    >
      <span className="shrink-0">
        {getPriorityIcon(task.priority ?? "no-priority")}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {task.title}
      </span>
      {task.number !== null && (
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {t("unified:consolidated.taskNumber", { number: task.number })}
        </span>
      )}
      {task.columnName && (
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {task.columnName}
        </Badge>
      )}
      <TaskLabels labels={task.labels ?? []} />
      {task.dueDate && (
        <span
          className={cn(
            "shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] tabular-nums",
            dueDateStatusColors[dueStatus],
          )}
          title={t("unified:consolidated.dueDate")}
        >
          {format(new Date(task.dueDate), "MMM d, yyyy")}
        </span>
      )}
      <Avatar className="size-5 shrink-0">
        <AvatarImage
          src={task.assigneeImage ?? undefined}
          alt={task.assigneeName ?? ""}
        />
        <AvatarFallback className="text-[10px]">
          {getInitials(task.assigneeName, "—")}
        </AvatarFallback>
      </Avatar>
    </button>
  );
}

function ConsolidatedTaskList({
  projects,
  mode,
}: {
  projects: ConsolidatedProject[];
  mode: ConsolidatedMode;
}) {
  const { t } = useTranslation();

  // Same query key and fetcher as useGetTasks, so the cross-project view
  // shares the per-project task cache instead of duplicating it.
  const queries = useQueries({
    queries: projects.map(({ project }) => ({
      queryKey: ["tasks", project.id],
      queryFn: () => getTasks(project.id),
      enabled: !!project.id,
    })),
  });

  const sections = useMemo(
    () =>
      projects.map((project, index) => {
        const data = queries[index]?.data;
        let tasks: ConsolidatedTask[] = [];
        if (data) {
          if (mode === "backlog") {
            tasks = [...(data.plannedTasks ?? [])];
          } else {
            tasks = (data.columns ?? []).flatMap((column) =>
              (column.tasks ?? []).map((task) => ({
                ...task,
                columnName: column.name,
                columnIsFinal: column.isFinal,
              })),
            );
          }
        }
        return { project, tasks };
      }),
    [projects, queries, mode],
  );

  const isLoading = projects.length > 0 && queries.some((q) => q.isLoading);
  const total = sections.reduce(
    (sum, section) => sum + section.tasks.length,
    0,
  );

  // Group the non-empty project sections per workspace, preserving the page's
  // workspace order (projects arrive in sorted-workspace order from the
  // route), so Backlog/Tasks read like the Overview and Charts tabs.
  const workspaceSections = useMemo(() => {
    const byWorkspace = new Map<
      string,
      { workspaceId: string; workspaceName: string; projects: typeof sections }
    >();
    for (const section of sections) {
      if (section.tasks.length === 0) continue;
      const group = byWorkspace.get(section.project.workspaceId) ?? {
        workspaceId: section.project.workspaceId,
        workspaceName: section.project.workspaceName,
        projects: [],
      };
      group.projects.push(section);
      byWorkspace.set(section.project.workspaceId, group);
    }
    return [...byWorkspace.values()];
  }, [sections]);

  const emptyCopy =
    mode === "backlog"
      ? {
          title: t("unified:empty.backlogTitle"),
          description: t("unified:empty.backlogDescription"),
        }
      : {
          title: t("unified:empty.tasksTitle"),
          description: t("unified:empty.tasksDescription"),
        };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
    );
  }

  if (total === 0) {
    return (
      <Empty className="min-h-[40vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {mode === "backlog" ? <Inbox /> : <ListChecks />}
          </EmptyMedia>
          <EmptyTitle>{emptyCopy.title}</EmptyTitle>
          <EmptyDescription>{emptyCopy.description}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {workspaceSections.map(({ workspaceId, workspaceName, projects }) => (
        <div className="flex flex-col gap-2" key={workspaceId}>
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">{workspaceName}</h3>
            <span className="text-xs text-muted-foreground">
              {t("unified:section.projectCount", {
                count: projects.length,
              })}
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {projects.map(({ project, tasks }) => {
              const IconComponent =
                icons[project.project.icon as keyof typeof icons] ||
                icons.Layout;
              return (
                <CardFrame key={project.project.id} className="min-w-0">
                  <CardFrameHeader>
                    <CardFrameTitle>
                      <span className="flex items-center gap-2">
                        <IconComponent
                          aria-hidden="true"
                          className="h-4 w-4 text-muted-foreground"
                        />
                        {project.project.name}
                      </span>
                    </CardFrameTitle>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t(
                        mode === "backlog"
                          ? "unified:consolidated.backlogCount"
                          : "unified:consolidated.tasksCount",
                        { count: tasks.length },
                      )}
                    </span>
                  </CardFrameHeader>
                  <CardPanel className="p-0">
                    <div className="divide-border/60 divide-y">
                      {tasks.map((task) => (
                        <ConsolidatedTaskRow
                          key={task.id}
                          task={task}
                          project={project}
                        />
                      ))}
                    </div>
                  </CardPanel>
                </CardFrame>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ConsolidatedTaskList;
