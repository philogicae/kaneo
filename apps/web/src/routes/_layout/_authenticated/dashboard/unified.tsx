import type { client } from "@kaneo/libs";
import { useQueries } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import type { InferResponseType } from "hono/client";
import { LayoutGrid } from "lucide-react";
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
import type Workspace from "@/types/workspace";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/unified",
)({
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

function RouteComponent() {
  const { t } = useTranslation();
  const { data: workspaces, isLoading: workspacesLoading } = useGetWorkspaces();

  const workspaceIds = useMemo(
    () => (workspaces ?? []).map((workspace) => workspace.id),
    [workspaces],
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
      (workspaces ?? []).map((workspace, index) => ({
        workspace,
        projects: projectQueries[index]?.data,
      })),
    [workspaces, projectQueries],
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
            <div className="flex items-center gap-1 w-full">
              <SidebarTrigger className="-ml-1 h-6 w-6" />
              <div className="mx-1.5 h-4 w-px shrink-0 bg-border/80" />
              <span className="text-xs font-normal text-card-foreground">
                {t("unified:pageTitle")}
              </span>
              <span className="text-xs font-normal text-muted-foreground hidden md:inline">
                · {t("unified:pageDescription")}
              </span>
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
                            {projects.map((project) => (
                              <ProjectRow
                                key={project.id}
                                project={{
                                  workspaceId: workspace.id,
                                  workspaceName: workspace.name,
                                  project,
                                }}
                              />
                            ))}
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
