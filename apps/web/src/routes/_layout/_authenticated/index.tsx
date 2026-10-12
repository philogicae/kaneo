import { useQueries } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import {
  ArrowUpDown,
  Blocks,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChartLine,
  Inbox,
  LayoutGrid,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "@/components/common/layout";
import UnifiedCharts from "@/components/dashboard/charts/unified-charts";
import ConsolidatedTaskList from "@/components/dashboard/consolidated-task-list";
import UnifiedAppointments from "@/components/dashboard/unified-appointments";
import UnifiedCalendar from "@/components/dashboard/unified-calendar";
import UnifiedGantt from "@/components/dashboard/unified-gantt";
import PageTitle from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import icons from "@/constants/project-icons";
import getProjects from "@/fetchers/project/get-projects";
import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
import { authClient } from "@/lib/auth-client";
import { handleUnauthorized, isUnauthorizedError } from "@/lib/http-error";
import {
  byNameDesc,
  type ProjectListItem,
  sortProjects,
} from "@/lib/project-sort";
import {
  isProjectSortMode,
  isWorkspaceSortMode,
  useUserPreferencesStore,
} from "@/store/user-preferences";
import type Workspace from "@/types/workspace";

export const Route = createFileRoute("/_layout/_authenticated/")({
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

type ProjectWithWorkspace = {
  workspaceId: string;
  workspaceName: string;
  project: ProjectListItem;
};

const UNIFIED_TABS = [
  "overview",
  "charts",
  "backlog",
  "tasks",
  "appointments",
  "calendar",
  "gantt",
] as const;

type UnifiedTab = (typeof UNIFIED_TABS)[number];

function isUnifiedTab(value: string): value is UnifiedTab {
  return (UNIFIED_TABS as readonly string[]).includes(value);
}

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

// One workspace tile in the dashboard grid: a compact, wrapping project list
// instead of a table, so tiles adapt to any width without clipping.
function ProjectTileRow({ project }: { project: ProjectWithWorkspace }) {
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
    <button
      type="button"
      className="flex w-full min-w-max flex-nowrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/40"
      onClick={() =>
        navigate({
          to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
          params: { workspaceId, projectId: item.id },
        })
      }
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <IconComponent
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-muted-foreground"
        />
        <span className="truncate text-sm font-medium text-foreground">
          {item.name}
        </span>
      </span>
      <span
        className="flex items-center gap-1.5"
        title={t("unified:table.progress")}
      >
        <Progress
          value={item.statistics.completionPercentage}
          className="w-12 h-1.5"
        />
        <span className="text-xs text-muted-foreground tabular-nums">
          {item.statistics.completionPercentage}%
        </span>
      </span>
      <span
        className="w-8 text-right text-xs text-muted-foreground tabular-nums"
        title={t("unified:charts.backlog")}
      >
        {item.statistics.plannedTasks}
      </span>
      <span
        className="w-8 text-right text-xs text-muted-foreground tabular-nums"
        title={t("unified:table.tasks")}
      >
        {item.statistics.totalTasks}
      </span>
      <Badge variant={statusVariant()}>{statusText()}</Badge>
    </button>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<UnifiedTab>("overview");
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
    const totalBacklog = withStats.reduce(
      (sum, entry) => sum + (entry.project.statistics?.plannedTasks ?? 0),
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

    return { totalProjects, totalTasks, totalBacklog, completion };
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
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <div className="min-w-0 overflow-x-auto">
                  <Tabs
                    value={activeTab}
                    onValueChange={(value) =>
                      setActiveTab(isUnifiedTab(value) ? value : "overview")
                    }
                  >
                    <TabsList className="h-8 w-max bg-card/60">
                      <TabsTrigger
                        className="h-full rounded-md px-2.5 text-xs [&[data-state=active]]:bg-accent [&[data-state=active]]:text-foreground"
                        value="overview"
                      >
                        <LayoutGrid
                          aria-hidden="true"
                          className="mr-1 h-3 w-3 shrink-0 max-2xl:hidden"
                        />
                        {t("unified:tabs.overview")}
                      </TabsTrigger>
                      <TabsTrigger
                        className="h-full rounded-md px-2.5 text-xs [&[data-state=active]]:bg-accent [&[data-state=active]]:text-foreground"
                        value="charts"
                      >
                        <ChartLine
                          aria-hidden="true"
                          className="mr-1 h-3 w-3 shrink-0 max-2xl:hidden"
                        />
                        {t("unified:tabs.charts")}
                      </TabsTrigger>
                      <TabsTrigger
                        className="h-full rounded-md px-2.5 text-xs [&[data-state=active]]:bg-accent [&[data-state=active]]:text-foreground"
                        value="backlog"
                      >
                        <Inbox
                          aria-hidden="true"
                          className="mr-1 h-3 w-3 shrink-0 max-2xl:hidden"
                        />
                        {t("unified:tabs.backlog")}
                      </TabsTrigger>
                      <TabsTrigger
                        className="h-full rounded-md px-2.5 text-xs [&[data-state=active]]:bg-accent [&[data-state=active]]:text-foreground"
                        value="tasks"
                      >
                        <ListChecks
                          aria-hidden="true"
                          className="mr-1 h-3 w-3 shrink-0 max-2xl:hidden"
                        />
                        {t("unified:tabs.tasks")}
                      </TabsTrigger>
                      <TabsTrigger
                        className="h-full rounded-md px-2.5 text-xs [&[data-state=active]]:bg-accent [&[data-state=active]]:text-foreground"
                        value="appointments"
                      >
                        <CalendarClock
                          aria-hidden="true"
                          className="mr-1 h-3 w-3 shrink-0 max-2xl:hidden"
                        />
                        {t("unified:tabs.appointments")}
                      </TabsTrigger>
                      <TabsTrigger
                        className="h-full rounded-md px-2.5 text-xs [&[data-state=active]]:bg-accent [&[data-state=active]]:text-foreground"
                        value="calendar"
                      >
                        <CalendarRange
                          aria-hidden="true"
                          className="mr-1 h-3 w-3 shrink-0 max-2xl:hidden"
                        />
                        {t("unified:tabs.calendar")}
                      </TabsTrigger>
                      <TabsTrigger
                        className="h-full rounded-md px-2.5 text-xs [&[data-state=active]]:bg-accent [&[data-state=active]]:text-foreground"
                        value="gantt"
                      >
                        <CalendarDays
                          aria-hidden="true"
                          className="mr-1 h-3 w-3 shrink-0 max-2xl:hidden"
                        />
                        {t("unified:tabs.gantt")}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    render={<Link to="/dashboard/settings/account/mcp" />}
                    variant="ghost"
                    size="xs"
                    className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
                    title={t("settings:mcpPage.pageTitle")}
                  >
                    <Blocks aria-hidden="true" className="h-3.5 w-3.5" />
                    {t("unified:links.mcp")}
                  </Button>
                  <Button
                    render={<Link to="/dashboard/settings/account/skills" />}
                    variant="ghost"
                    size="xs"
                    className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
                    title={t("settings:skillsPage.pageTitle")}
                  >
                    <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                    {t("unified:links.skills")}
                  </Button>
                </div>
              </div>
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
          <div className="flex w-full flex-col gap-4 p-4">
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
                    label={t("unified:charts.backlog")}
                    value={String(stats.totalBacklog)}
                  />
                  <StatCard
                    label={t("unified:stats.tasks")}
                    value={String(stats.totalTasks)}
                  />
                  <StatCard
                    label={t("unified:stats.completion")}
                    value={`${stats.completion}%`}
                  />
                </div>
                {activeTab === "charts" ? (
                  <UnifiedCharts
                    sections={sections}
                    projectsSort={projectsSort}
                  />
                ) : null}
                {(activeTab === "backlog" || activeTab === "tasks") && (
                  <ConsolidatedTaskList
                    projects={allProjects}
                    mode={activeTab}
                  />
                )}
                {activeTab === "appointments" ? (
                  <UnifiedAppointments projects={allProjects} />
                ) : null}
                {activeTab === "calendar" ? (
                  <UnifiedCalendar projects={allProjects} />
                ) : null}
                {activeTab === "gantt" ? (
                  <UnifiedGantt projects={allProjects} />
                ) : null}
                {activeTab === "overview" ? (
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] gap-4 items-stretch">
                    {sections.map(({ workspace, projects }) =>
                      !projects || projects.length === 0 ? null : (
                        <CardFrame
                          key={workspace.id}
                          className="h-full min-w-0"
                        >
                          <CardFrameHeader>
                            <CardFrameTitle>{workspace.name}</CardFrameTitle>
                            <CardFrameDescription>
                              {t("unified:section.projectCount", {
                                count: projects.length,
                              })}
                            </CardFrameDescription>
                          </CardFrameHeader>
                          <CardPanel className="p-0">
                            <div className="divide-border/60 divide-y overflow-x-auto">
                              {sortProjects(projects, projectsSort).map(
                                (project) => (
                                  <ProjectTileRow
                                    key={project.id}
                                    project={{
                                      workspaceId: workspace.id,
                                      workspaceName: workspace.name,
                                      project,
                                    }}
                                  />
                                ),
                              )}
                            </div>
                          </CardPanel>
                        </CardFrame>
                      ),
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </Layout.Content>
      </Layout>
    </>
  );
}
