import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ProgressChart from "@/components/dashboard/progress-chart";
import {
  CardFrame,
  CardFrameDescription,
  CardFrameHeader,
  CardFrameTitle,
  CardPanel,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import icons from "@/constants/project-icons";
import getProjectCharts from "@/fetchers/project/get-project-charts";
import getTasks from "@/fetchers/task/get-tasks";
import { type ProjectListItem, sortProjects } from "@/lib/project-sort";
import {
  CHART_MONTH_OPTIONS,
  isChartMonths,
  type ProjectSortMode,
  useUserPreferencesStore,
} from "@/store/user-preferences";
import { aggregateBuckets, recentVelocity } from "./chart-utils";
import StatusDistribution, { type StatusSegment } from "./status-distribution";
import VelocityChart from "./velocity-chart";
import WorkloadChart, { type WorkloadItem } from "./workload-chart";

type ChartsSection = {
  workspace: { id: string; name: string };
  projects: ProjectListItem[] | undefined;
};

type UnifiedChartsProps = {
  sections: ChartsSection[];
  projectsSort: ProjectSortMode;
};

type TasksResponse = Awaited<ReturnType<typeof getTasks>>;

function statusSegmentsFor(
  data: TasksResponse | undefined,
  backlogLabel: string,
): StatusSegment[] {
  if (!data) return [];
  const segments: StatusSegment[] = [];
  for (const column of data.columns ?? []) {
    const count = column.tasks?.length ?? 0;
    if (count > 0) {
      segments.push({ name: column.name ?? "—", count });
    }
  }
  const planned = data.plannedTasks?.length ?? 0;
  if (planned > 0) {
    segments.push({ name: backlogLabel, count: planned });
  }
  return segments;
}

function workloadFor(
  data: TasksResponse | undefined,
  unassignedLabel: string,
): WorkloadItem[] {
  const byAssignee = new Map<string, WorkloadItem>();
  for (const column of data?.columns ?? []) {
    for (const task of column.tasks ?? []) {
      const id = task.assigneeId ?? "__unassigned";
      const current = byAssignee.get(id) ?? {
        id,
        name: task.assigneeName ?? unassignedLabel,
        count: 0,
        image: task.assigneeImage,
      };
      current.count += 1;
      byAssignee.set(id, current);
    }
  }
  return [...byAssignee.values()];
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

// The charts tab of the unified dashboard: a period filter driving a global
// velocity chart, a workload reading, a cross-project status breakdown, and
// the per-project progression and distribution cards.
export default function UnifiedCharts({
  sections,
  projectsSort,
}: UnifiedChartsProps) {
  const { t } = useTranslation();
  const { chartsMonths, setChartsMonths } = useUserPreferencesStore();

  const projectEntries = useMemo(
    () =>
      sections.flatMap(({ workspace, projects }) =>
        (projects ?? []).map((project) => ({ workspace, project })),
      ),
    [sections],
  );

  const chartQueries = useQueries({
    queries: projectEntries.map(({ project }) => ({
      queryKey: ["project-charts", project.id, chartsMonths],
      queryFn: () => getProjectCharts(project.id, chartsMonths),
      staleTime: 1000 * 60,
    })),
  });

  // Same query key and fetcher as the board/backlog lists, so this tab reads
  // the shared task cache instead of duplicating the requests.
  const taskQueries = useQueries({
    queries: projectEntries.map(({ project }) => ({
      queryKey: ["tasks", project.id],
      queryFn: () => getTasks(project.id),
    })),
  });

  const backlogLabel = t("unified:charts.backlog");
  const unassignedLabel = t("unified:charts.unassigned");

  const isLoadingCharts =
    projectEntries.length > 0 && chartQueries.some((query) => query.isLoading);
  const isLoadingTasks =
    projectEntries.length > 0 && taskQueries.some((query) => query.isLoading);

  const allBuckets = useMemo(
    () => aggregateBuckets(chartQueries.map((query) => query.data)),
    [chartQueries],
  );

  const statusSegments = useMemo(() => {
    const counts = new Map<string, number>();
    let backlog = 0;
    for (const query of taskQueries) {
      for (const column of query.data?.columns ?? []) {
        const count = column.tasks?.length ?? 0;
        if (count > 0) {
          const name = column.name ?? "—";
          counts.set(name, (counts.get(name) ?? 0) + count);
        }
      }
      backlog += query.data?.plannedTasks?.length ?? 0;
    }
    const segments = [...counts].map(([name, count]) => ({ name, count }));
    if (backlog > 0) {
      segments.push({ name: backlogLabel, count: backlog });
    }
    return segments;
  }, [taskQueries, backlogLabel]);

  const workloadItems = useMemo(() => {
    const byAssignee = new Map<string, WorkloadItem>();
    for (const query of taskQueries) {
      for (const item of workloadFor(query.data, unassignedLabel)) {
        const existing = byAssignee.get(item.id);
        if (existing) {
          existing.count += item.count;
        } else {
          byAssignee.set(item.id, item);
        }
      }
    }
    return [...byAssignee.values()];
  }, [taskQueries, unassignedLabel]);

  const periodCreated = allBuckets.reduce(
    (sum, bucket) => sum + bucket.created,
    0,
  );
  const periodCompleted = allBuckets.reduce(
    (sum, bucket) => sum + bucket.completed,
    0,
  );
  const velocity = recentVelocity(allBuckets);

  const workspaceSections = useMemo(
    () =>
      sections
        .map(({ workspace, projects }) => ({
          workspace,
          projects: sortProjects(projects ?? [], projectsSort),
        }))
        .filter(({ projects }) => projects.length > 0),
    [sections, projectsSort],
  );

  const projectIndex = useMemo(
    () =>
      new Map(projectEntries.map(({ project }, index) => [project.id, index])),
    [projectEntries],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t("unified:charts.period")}
          </span>
          <Tabs
            value={String(chartsMonths)}
            onValueChange={(value) => {
              const months = Number(value);
              if (isChartMonths(months)) setChartsMonths(months);
            }}
          >
            <TabsList className="h-7 bg-card/60">
              {CHART_MONTH_OPTIONS.map((months) => (
                <TabsTrigger
                  key={months}
                  className="h-full rounded-md px-2.5 text-xs [&[data-state=active]]:bg-accent [&[data-state=active]]:text-foreground"
                  value={String(months)}
                >
                  {t("unified:charts.range", { count: months })}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {isLoadingCharts
            ? "…"
            : t("unified:charts.periodSummary", {
                created: periodCreated,
                completed: periodCompleted,
              })}
        </p>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <CardFrame className="h-full min-w-0 lg:col-span-2">
          <CardFrameHeader>
            <CardFrameTitle>{t("unified:charts.velocityTitle")}</CardFrameTitle>
            <CardFrameDescription>
              {t("unified:charts.velocityDescription")}
            </CardFrameDescription>
          </CardFrameHeader>
          <CardPanel className="space-y-3">
            <VelocityChart buckets={allBuckets} isLoading={isLoadingCharts} />
            <div className="flex flex-wrap gap-6 border-t border-border/60 pt-3">
              <MiniStat
                label={t("unified:charts.created")}
                value={String(periodCreated)}
              />
              <MiniStat
                label={t("unified:charts.completed")}
                value={String(periodCompleted)}
              />
              <MiniStat
                label={t("unified:charts.velocity4w")}
                value={t("unified:charts.perWeek", {
                  value: velocity.toFixed(1),
                })}
              />
            </div>
          </CardPanel>
        </CardFrame>

        <CardFrame className="h-full min-w-0">
          <CardFrameHeader>
            <CardFrameTitle>{t("unified:charts.workloadTitle")}</CardFrameTitle>
            <CardFrameDescription>
              {t("unified:charts.workloadDescription")}
            </CardFrameDescription>
          </CardFrameHeader>
          <CardPanel>
            <WorkloadChart items={workloadItems} isLoading={isLoadingTasks} />
          </CardPanel>
        </CardFrame>
      </div>

      <CardFrame>
        <CardFrameHeader>
          <CardFrameTitle>{t("unified:charts.statusTitle")}</CardFrameTitle>
          <CardFrameDescription>
            {t("unified:charts.statusDescription")}
          </CardFrameDescription>
        </CardFrameHeader>
        <CardPanel>
          <StatusDistribution
            segments={statusSegments}
            isLoading={isLoadingTasks}
            maxSegments={8}
          />
        </CardPanel>
      </CardFrame>

      <h3 className="text-sm font-semibold">{t("unified:charts.byProject")}</h3>

      {workspaceSections.map(({ workspace, projects }) => (
        <div className="flex flex-col gap-2" key={workspace.id}>
          <div className="flex items-baseline justify-between">
            <h4 className="text-sm font-semibold">{workspace.name}</h4>
            <span className="text-xs text-muted-foreground">
              {t("unified:section.projectCount", {
                count: projects.length,
              })}
            </span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] items-stretch gap-4">
            {projects.map((project) => {
              const index = projectIndex.get(project.id) ?? -1;
              const buckets =
                index >= 0 ? chartQueries[index]?.data : undefined;
              const tasks = index >= 0 ? taskQueries[index]?.data : undefined;
              const projectCreated = (buckets ?? []).reduce(
                (sum, bucket) => sum + bucket.created,
                0,
              );
              const projectCompleted = (buckets ?? []).reduce(
                (sum, bucket) => sum + bucket.completed,
                0,
              );
              const IconComponent =
                icons[project.icon as keyof typeof icons] || icons.Layout;

              return (
                <CardFrame key={project.id} className="h-full min-w-0">
                  <CardFrameHeader>
                    <CardFrameTitle>
                      <span className="flex items-center gap-2">
                        <IconComponent
                          aria-hidden="true"
                          className="h-4 w-4 text-muted-foreground"
                        />
                        {project.name}
                      </span>
                    </CardFrameTitle>
                  </CardFrameHeader>
                  <CardPanel className="space-y-4">
                    <div className="flex flex-wrap gap-6 border-b border-border/60 pb-3">
                      <MiniStat
                        label={t("unified:charts.created")}
                        value={String(projectCreated)}
                      />
                      <MiniStat
                        label={t("unified:charts.completed")}
                        value={String(projectCompleted)}
                      />
                      <MiniStat
                        label={t("unified:charts.velocity4w")}
                        value={t("unified:charts.perWeek", {
                          value: recentVelocity(buckets ?? []).toFixed(1),
                        })}
                      />
                    </div>
                    <ProgressChart
                      buckets={buckets}
                      isLoading={
                        index >= 0 ? chartQueries[index]?.isLoading : true
                      }
                    />
                    <StatusDistribution
                      segments={statusSegmentsFor(tasks, backlogLabel)}
                      isLoading={
                        index >= 0 ? taskQueries[index]?.isLoading : true
                      }
                      maxSegments={4}
                    />
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
