import type { client } from "@kaneo/libs";
import { useQueries } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import type { InferResponseType } from "hono/client";
import { ArrowUpDown, LayoutGrid } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import Layout from "@/components/common/layout";
import PageTitle from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardFrame,
  CardFrameDescription,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Progress } from "@/components/ui/progress";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import icons from "@/constants/project-icons";
import getProjects from "@/fetchers/project/get-projects";
import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
import { authClient } from "@/lib/auth-client";
import { formatDateMedium } from "@/lib/format";
import { handleUnauthorized, isUnauthorizedError } from "@/lib/http-error";
import {
  isProjectSortMode,
  isWorkspaceSortMode,
  useUserPreferencesStore,
} from "@/store/user-preferences";
import type Workspace from "@/types/workspace";

export const Route = createFileRoute("/_layout/_authenticated/dashboards")({
  beforeLoad: async () => {
    // The sidebar reads the active organization (there is no workspaceId
    // route param here), so make sure one is active before rendering.
    let workspaces: Workspace[];
    try {
      workspaces = await getWorkspaces();
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleUnauthorized();
        return;
      }
      throw error;
    }

    if (!workspaces.length) {
      throw redirect({ to: "/onboarding" });
    }

    const session = await authClient.getSession();
    const activeWorkspaceId = session?.data?.session?.activeOrganizationId;
    if (
      !activeWorkspaceId ||
      !workspaces.some((ws) => ws.id === activeWorkspaceId)
    ) {
      authClient.organization.setActive({
        organizationId: workspaces[0].id,
      });
    }
  },
  component: RouteComponent,
});

type ProjectListItem = InferResponseType<
  (typeof client)["project"]["$get"],
  200
>[number];

type ProjectWithWorkspace = {
  workspaceId: string;
  workspaceName: string;
  project: ProjectListItem;
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-1 px-4 py-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </Card>
  );
}

function SortControl({
  label,
  ariaLabel,
  value,
  modes,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value: string;
  modes: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const current = modes.find((mode) => mode.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={ariaLabel}
            title={ariaLabel}
            className="flex h-6 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground outline-hidden ring-sidebar-ring transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2"
          />
        }
      >
        <ArrowUpDown aria-hidden="true" className="h-3 w-3 shrink-0" />
        <span className="hidden sm:inline">{label}</span>
        <span className="hidden md:inline text-muted-foreground/70">
          · {current?.label}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 rounded-lg">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {modes.map((mode) => (
            <DropdownMenuRadioItem key={mode.value} value={mode.value}>
              {mode.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectRow({ project }: { project: ProjectWithWorkspace }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { project: item, workspaceId } = project;

  if (!item?.id || !item.statistics) return null;

  const IconComponent = icons[item.icon as keyof typeof icons] || icons.Layout;

  const statusText = () => {
    if (item.statistics.totalTasks === 0)
      return t("workspace:projects.projectStatus.notStarted");
    if (item.statistics.completionPercentage === 100)
      return t("workspace:projects.projectStatus.complete");
    return t("workspace:projects.projectStatus.inProgress");
  };

  const statusVariant = () => {
    if (item.statistics.totalTasks === 0) return "secondary";
    if (item.statistics.completionPercentage === 100) return "default";
    return "outline";
  };

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() =>
        navigate({
          to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
          params: { workspaceId, projectId: item.id },
        })
      }
    >
      <TableCell className="py-3">
        <div className="flex items-center gap-3">
          <IconComponent className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium">{item.name}</span>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <div className="flex items-center gap-2">
          <Progress
            value={item.statistics.completionPercentage}
            className="w-16 h-2"
          />
          <span className="text-sm text-muted-foreground tabular-nums">
            {item.statistics.completionPercentage}%
          </span>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <span className="text-sm text-muted-foreground tabular-nums">
          {item.statistics.totalTasks}
        </span>
      </TableCell>
      <TableCell className="py-3">
        <span className="text-sm text-muted-foreground">
          {item.statistics.dueDate
            ? formatDateMedium(item.statistics.dueDate)
            : t("workspace:projects.noDueDate")}
        </span>
      </TableCell>
      <TableCell className="py-3">
        <Badge variant={statusVariant()}>{statusText()}</Badge>
      </TableCell>
    </TableRow>
  );
}

// Shared sorting for the dashboard and the sidebar: alphabetical by name by
// default, stored custom order only applies when explicitly picked.
function byNameDesc(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function sortProjects(
  projects: ProjectListItem[],
  mode: ReturnType<typeof useUserPreferencesStore.getState>["projectsSort"],
): ProjectListItem[] {
  if (mode === "name") {
    return [...projects].sort((a, b) => byNameDesc(a.name, b.name));
  }
  if (mode === "date") {
    return [...projects].sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime(),
    );
  }
  if (mode === "completion") {
    return [...projects].sort(
      (a, b) =>
        (b.statistics?.completionPercentage ?? -1) -
        (a.statistics?.completionPercentage ?? -1),
    );
  }
  return projects;
}

function RouteComponent() {
  const { t } = useTranslation();
  const { data: workspaces, isLoading: workspacesLoading } = useGetWorkspaces();
  const {
    workspaceSort,
    setWorkspaceSort,
    workspaceOrder,
    projectsSort,
    setProjectsSort,
  } = useUserPreferencesStore();

  const sortedWorkspaces = useMemo(() => {
    if (!workspaces) return undefined;
    if (workspaceSort === "name") {
      return [...workspaces].sort((a, b) => byNameDesc(a.name, b.name));
    }
    if (workspaceSort === "date") {
      return [...workspaces].sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime(),
      );
    }
    const rank = new Map(workspaceOrder.map((id, index) => [id, index]));
    return [...workspaces].sort(
      (a, b) =>
        (rank.get(a.id) ?? Number.POSITIVE_INFINITY) -
        (rank.get(b.id) ?? Number.POSITIVE_INFINITY),
    );
  }, [workspaces, workspaceSort, workspaceOrder]);

  const workspaceIds = useMemo(
    () => (sortedWorkspaces ?? []).map((workspace) => workspace.id),
    [sortedWorkspaces],
  );

  const projectQueries = useQueries({
    queries: workspaceIds.map((workspaceId) => ({
      queryKey: ["projects", workspaceId],
      queryFn: () => getProjects({ workspaceId }),
      enabled: !!workspaceId,
    })),
  });

  const sections = useMemo(
    () =>
      (sortedWorkspaces ?? []).map((workspace, index) => ({
        workspace,
        projects: projectQueries[index]?.data,
      })),
    [sortedWorkspaces, projectQueries],
  );

  const allProjects = useMemo<ProjectWithWorkspace[]>(
    () =>
      sections.flatMap(({ workspace, projects }) =>
        (projects ?? []).map((project) => ({
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          project,
        })),
      ),
    [sections],
  );

  const stats = useMemo(() => {
    const withStats = allProjects.filter((entry) => entry.project?.statistics);
    const totalProjects = withStats.length;
    const totalTasks = withStats.reduce(
      (sum, entry) => sum + (entry.project.statistics?.totalTasks ?? 0),
      0,
    );
    const completedTasks = withStats.reduce(
      (sum, entry) =>
        sum +
        ((entry.project.statistics?.totalTasks ?? 0) *
          (entry.project.statistics?.completionPercentage ?? 0)) /
          100,
      0,
    );
    const completion =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const nextDueDate = withStats
      .map((entry) => entry.project.statistics?.dueDate)
      .filter((dueDate): dueDate is string => Boolean(dueDate))
      .map((dueDate) => new Date(dueDate))
      .filter((date) => date.getTime() >= startOfToday.getTime())
      .sort((a, b) => a.getTime() - b.getTime())[0];

    return { totalProjects, totalTasks, completion, nextDueDate };
  }, [allProjects]);

  const isLoading =
    workspacesLoading ||
    projectQueries.some((query) => query.isLoading) ||
    !workspaces;

  const isEmpty = !isLoading && allProjects.length === 0;

  return (
    <>
      <PageTitle title={t("unified:pageTitle")} />
      <Layout>
        <Layout.Header>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5 w-full min-w-0">
              <SidebarTrigger className="-ml-1 h-6 w-6" />
              <div className="mx-1.5 h-4 w-px shrink-0 bg-border/80" />
              <span className="text-xs font-normal text-card-foreground truncate">
                {t("unified:pageTitle")}
              </span>
              <div className="flex items-center gap-1 ml-auto shrink-0">
                <SortControl
                  label={t("navigation:workspaceSwitcher.workspaces")}
                  ariaLabel={t("navigation:workspaceSwitcher.sortWorkspaces")}
                  value={workspaceSort}
                  modes={[
                    {
                      value: "name",
                      label: t("navigation:projectList.sortName"),
                    },
                    {
                      value: "date",
                      label: t("navigation:projectList.sortDate"),
                    },
                    {
                      value: "custom",
                      label: t("navigation:projectList.sortCustom"),
                    },
                  ]}
                  onChange={(value) =>
                    isWorkspaceSortMode(value) && setWorkspaceSort(value)
                  }
                />
                <SortControl
                  label={t("unified:stats.projects")}
                  ariaLabel={t("navigation:projectList.sortProjects")}
                  value={projectsSort}
                  modes={[
                    {
                      value: "name",
                      label: t("navigation:projectList.sortName"),
                    },
                    {
                      value: "date",
                      label: t("navigation:projectList.sortDate"),
                    },
                    {
                      value: "custom",
                      label: t("navigation:projectList.sortCustom"),
                    },
                    {
                      value: "completion",
                      label: t("navigation:projectList.sortCompletion"),
                    },
                  ]}
                  onChange={(value) =>
                    isProjectSortMode(value) && setProjectsSort(value)
                  }
                />
              </div>
            </div>
          </div>
        </Layout.Header>
        <Layout.Content>
          <div className="flex flex-col gap-4 p-4 max-w-5xl mx-auto w-full">
            {isLoading ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
                <Skeleton className="h-64" />
              </>
            ) : isEmpty ? (
              <Empty className="min-h-[60vh]">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <LayoutGrid />
                  </EmptyMedia>
                  <EmptyTitle>{t("unified:empty.title")}</EmptyTitle>
                  <EmptyDescription>
                    {t("unified:empty.description")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard
                    label={t("unified:stats.projects")}
                    value={String(stats.totalProjects)}
                  />
                  <StatCard
                    label={t("unified:stats.tasks")}
                    value={String(stats.totalTasks)}
                  />
                  <StatCard
                    label={t("unified:stats.completion")}
                    value={`${stats.completion}%`}
                  />
                  <StatCard
                    label={t("unified:stats.nextDueDate")}
                    value={
                      stats.nextDueDate
                        ? formatDateMedium(stats.nextDueDate.toISOString())
                        : t("workspace:projects.noDueDate")
                    }
                  />
                </div>
                {sections.map(({ workspace, projects }) =>
                  !projects || projects.length === 0 ? null : (
                    <CardFrame key={workspace.id}>
                      <CardFrameHeader>
                        <CardFrameTitle>{workspace.name}</CardFrameTitle>
                        <CardFrameDescription>
                          {t("unified:section.projectCount", {
                            count: projects.length,
                          })}
                        </CardFrameDescription>
                      </CardFrameHeader>
                      <CardPanel className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-foreground font-medium">
                                {t("unified:table.project")}
                              </TableHead>
                              <TableHead className="text-foreground font-medium">
                                {t("unified:table.progress")}
                              </TableHead>
                              <TableHead className="text-foreground font-medium">
                                {t("unified:table.tasks")}
                              </TableHead>
                              <TableHead className="text-foreground font-medium">
                                {t("unified:table.dueDate")}
                              </TableHead>
                              <TableHead className="text-foreground font-medium">
                                {t("unified:table.status")}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortProjects(projects, projectsSort).map(
                              (project) => (
                                <ProjectRow
                                  key={project.id}
                                  project={{
                                    workspaceId: workspace.id,
                                    workspaceName: workspace.name,
                                    project,
                                  }}
                                />
                              ),
                            )}
                          </TableBody>
                        </Table>
                      </CardPanel>
                    </CardFrame>
                  ),
                )}
              </>
            )}
          </div>
        </Layout.Content>
      </Layout>
    </>
  );
}
