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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import icons from "@/constants/project-icons";
import getProjectCharts from "@/fetchers/project/get-project-charts";
import getTasks from "@/fetchers/task/get-tasks";
import { type ProjectListItem, sortProjects } from "@/lib/project-sort";
import {
  CHART_RANGE_OPTIONS,
  CHART_UNIT_OPTIONS,
  CHART_UNITS_BY_RANGE,
  type ChartRange,
  type ChartUnit,
  defaultChartUnit,
  isChartRange,
  isChartUnit,
  type ProjectSortMode,
  rangeSupportingUnit,
  useUserPreferencesStore,
} from "@/store/user-preferences";
import {
  aggregateBuckets,
  averageCompleted,
  summarizeTasks,
} from "./chart-utils";
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
    segments.push({
      name: column.name ?? "—",
      count: column.tasks?.length ?? 0,
      slug: column.slug,
    });
  }
  segments.push({
    name: backlogLabel,
    count: data.plannedTasks?.length ?? 0,
    slug: "planned",
  });
  return segments;
}

function workloadFor(
  data: TasksResponse | undefined,
  unassignedLabel: string,
  openOnly = true,
): WorkloadItem[] {
  const byAssignee = new Map<string, WorkloadItem>();
  for (const column of data?.columns ?? []) {
    if (openOnly && column.isFinal) continue;
    for (const task of column.tasks ?? []) {
      const id = task.assigneeId ?? "__unassigned";
      const current = byAssignee.get(id) ?? {
        id,
        name: task.assigneeName ?? unassignedLabel,
        count: 0,
        image: task.assigneeImage,
        isUnassigned: id === "__unassigned",
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
      <p className="text-[0.625rem] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function rangeLabel(
  range: ChartRange,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (range === "1w") return t("unified:charts.rangeWeek");
  if (range === "all") return t("unified:charts.rangeAll");
  return t("unified:charts.range", { count: Number.parseInt(range, 10) });
}

const UNIT_LABEL_KEYS: Record<ChartUnit, string> = {
  hour: "unified:charts.unitLabelHour",
  day: "unified:charts.unitLabelDay",
  week: "unified:charts.unitLabelWeek",
  month: "unified:charts.unitLabelMonth",
};

// Lowercase unit words interpolated into the per-unit average label.
const UNIT_WORD_KEYS: Record<ChartUnit, string> = {
  hour: "unified:charts.unitHour",
  day: "unified:charts.unitDay",
  week: "unified:charts.unitWeek",
  month: "unified:charts.unitMonth",
};

// The charts tab of the unified dashboard: a period filter driving a global
// velocity chart, a workload reading, a cross-project status breakdown, and
// the per-project progression and distribution cards.
export default function UnifiedCharts({
  sections,
  projectsSort,
}: UnifiedChartsProps) {
  const { t } = useTranslation();
  const { chartsRange, chartsUnit, setChartsRange, setChartsUnit } =
    useUserPreferencesStore();

  // Base UI renders the selected item's label from this map, since the
  // dropdown items are portaled and not mounted until the popup opens.
  const rangeItems = CHART_RANGE_OPTIONS.map((range) => ({
    label: rangeLabel(range, t),
    value: range,
  }));
  const unitItems = CHART_UNIT_OPTIONS.map((unit) => ({
    label: t(UNIT_LABEL_KEYS[unit]),
    value: unit,
  }));

  const projectEntries = useMemo(
    () =>
      sections.flatMap(({ workspace, projects }) =>
        (projects ?? []).map((project) => ({ workspace, project })),
      ),
    [sections],
  );

  const chartQueries = useQueries({
    queries: projectEntries.map(({ project }) => ({
      queryKey: ["project-charts", project.id, chartsRange, chartsUnit],
      queryFn: () => getProjectCharts(project.id, chartsRange, chartsUnit),
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
    const counts = new Map<string, { name: string; count: number }>();
    let backlog = 0;
    for (const query of taskQueries) {
      for (const column of query.data?.columns ?? []) {
        const count = column.tasks?.length ?? 0;
        const current = counts.get(column.slug) ?? {
          name: column.name ?? "—",
          count: 0,
        };
        current.count += count;
        counts.set(column.slug, current);
      }
      backlog += query.data?.plannedTasks?.length ?? 0;
    }
    const segments: StatusSegment[] = [...counts].map(([slug, entry]) => ({
      ...entry,
      slug,
    }));
    segments.push({ name: backlogLabel, count: backlog, slug: "planned" });
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

  const projectStats = useMemo(
    () =>
      projectEntries.map((_, index) =>
        summarizeTasks(taskQueries[index]?.data),
      ),
    [projectEntries, taskQueries],
  );

  const globalStats = useMemo(
    () =>
      projectStats.reduce(
        (total, stats) => ({
          total: total.total + stats.total,
          open: total.open + stats.open,
          done: total.done + stats.done,
          backlog: total.backlog + stats.backlog,
          overdue: total.overdue + stats.overdue,
          dueSoon: total.dueSoon + stats.dueSoon,
          assignees: total.assignees + stats.assignees,
          completion: 0,
        }),
        {
          total: 0,
          open: 0,
          done: 0,
          backlog: 0,
          overdue: 0,
          dueSoon: 0,
          assignees: 0,
          completion: 0,
        },
      ),
    [projectStats],
  );
  // Match the status bar exactly: backlog is part of the denominator, unlike
  // the board-only completion used by the project cards.
  const statusTotal = statusSegments.reduce(
    (sum, segment) => sum + segment.count,
    0,
  );
  const statusDone =
    statusSegments.find((segment) => segment.slug === "done")?.count ?? 0;
  const globalCompletion =
    statusTotal > 0 ? Math.round((statusDone / statusTotal) * 100) : 0;

  const periodCreated = allBuckets.reduce(
    (sum, bucket) => sum + bucket.created,
    0,
  );
  const periodCompleted = allBuckets.reduce(
    (sum, bucket) => sum + bucket.completed,
    0,
  );
  const velocity = averageCompleted(allBuckets);
  const velocityUnit = t(UNIT_WORD_KEYS[chartsUnit]);

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

  // Keep the bucket size valid when the window changes: fall back to the
  // default unit of the new range (daily, or weekly for "all").
  const handleRangeChange = (value: string | null) => {
    if (!isChartRange(value)) return;
    setChartsRange(value);
    if (!CHART_UNITS_BY_RANGE[value].includes(chartsUnit)) {
      setChartsUnit(defaultChartUnit(value));
    }
  };

  // Every unit stays selectable: a finer one than the current window carries
  // (hour on "all", day on "all") moves the period to the longest window that
  // supports it instead of leaving the option dead.
  const handleUnitChange = (value: string | null) => {
    if (!isChartUnit(value)) return;
    const nextRange = rangeSupportingUnit(chartsRange, value);
    if (nextRange !== chartsRange) {
      setChartsRange(nextRange);
    }
    setChartsUnit(value);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          {t("unified:charts.overviewTitle")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("unified:charts.overviewDescription")}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t("unified:charts.period")}
            </span>
            <Select
              items={rangeItems}
              value={chartsRange}
              onValueChange={handleRangeChange}
            >
              <SelectTrigger
                aria-label={t("unified:charts.period")}
                className="min-w-32"
                size="sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_RANGE_OPTIONS.map((range) => (
                  <SelectItem key={range} value={range}>
                    {rangeLabel(range, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t("unified:charts.unit")}
            </span>
            <Select
              items={unitItems}
              value={chartsUnit}
              onValueChange={handleUnitChange}
            >
              <SelectTrigger
                aria-label={t("unified:charts.unit")}
                className="min-w-24"
                size="sm"
                title={t("unified:charts.unitHint")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_UNIT_OPTIONS.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {t(UNIT_LABEL_KEYS[unit])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
              {t("unified:charts.velocityDescription", {
                unit: velocityUnit,
              })}
            </CardFrameDescription>
          </CardFrameHeader>
          <CardPanel className="space-y-3">
            <VelocityChart
              buckets={allBuckets}
              unit={chartsUnit}
              isLoading={isLoadingCharts}
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/60 pt-3 sm:flex sm:flex-wrap sm:gap-6">
              <MiniStat
                label={t("unified:charts.created")}
                value={String(periodCreated)}
              />
              <MiniStat
                label={t("unified:charts.completed")}
                value={String(periodCompleted)}
              />
              <MiniStat
                label={t("unified:charts.average")}
                value={t("unified:charts.perUnit", {
                  value: velocity.toFixed(1),
                  unit: velocityUnit,
                })}
              />
              <MiniStat
                label={t("unified:charts.openNow")}
                value={String(globalStats.open)}
              />
              <MiniStat
                label={t("unified:charts.overdue")}
                value={String(globalStats.overdue)}
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
          <CardPanel className="space-y-3">
            <WorkloadChart items={workloadItems} isLoading={isLoadingTasks} />
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/60 pt-3 sm:flex sm:flex-wrap sm:gap-6">
              <MiniStat
                label={t("unified:charts.openNow")}
                value={String(globalStats.open)}
              />
              <MiniStat
                label={t("unified:charts.assignees")}
                value={String(
                  workloadItems.filter((item) => !item.isUnassigned).length,
                )}
              />
            </div>
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
        <CardPanel className="space-y-3">
          <StatusDistribution
            segments={statusSegments}
            isLoading={isLoadingTasks}
            maxSegments={8}
          />
          <div className="flex items-center gap-3 border-t border-border/60 pt-3">
            <span className="shrink-0 text-[0.625rem] text-muted-foreground">
              {t("unified:stats.completion")}
            </span>
            <Progress
              value={globalCompletion}
              className="h-1.5 flex-1 [&_[data-slot=progress-indicator]]:bg-[var(--color-emerald-500)]"
            />
            <span className="w-8 shrink-0 text-right text-[0.625rem] tabular-nums text-muted-foreground">
              {globalCompletion}%
            </span>
          </div>
        </CardPanel>
      </CardFrame>

      <div className="flex flex-wrap items-end justify-between gap-2 border-t border-border/60 pt-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-sm font-semibold tracking-tight">
            {t("unified:charts.byProject")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("unified:charts.byProjectDescription")}
          </p>
        </div>
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
          {t("unified:section.projectCount", {
            count: projectEntries.length,
          })}
        </span>
      </div>

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
              const stats = projectStats[index] ?? summarizeTasks(undefined);
              const projectWorkload = workloadFor(tasks, unassignedLabel);
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
                    <CardFrameDescription>
                      {t("unified:charts.projectSummary", {
                        tasks: stats.total,
                        completion: stats.completion,
                      })}
                    </CardFrameDescription>
                  </CardFrameHeader>
                  <CardPanel className="space-y-4">
                    <div className="grid grid-cols-3 gap-x-4 gap-y-3 border-b border-border/60 pb-3 sm:flex sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
                      <MiniStat
                        label={t("unified:charts.created")}
                        value={String(projectCreated)}
                      />
                      <MiniStat
                        label={t("unified:charts.completed")}
                        value={String(projectCompleted)}
                      />
                      <MiniStat
                        label={t("unified:charts.average")}
                        value={t("unified:charts.perUnit", {
                          value: averageCompleted(buckets ?? []).toFixed(1),
                          unit: velocityUnit,
                        })}
                      />
                      <MiniStat
                        label={t("unified:charts.openNow")}
                        value={String(stats.open)}
                      />
                      <MiniStat
                        label={t("unified:charts.overdue")}
                        value={String(stats.overdue)}
                      />
                      <MiniStat
                        label={t("unified:charts.dueSoon")}
                        value={String(stats.dueSoon)}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="shrink-0 text-[0.625rem] text-muted-foreground">
                        {t("unified:stats.completion")}
                      </span>
                      <Progress
                        value={stats.completion}
                        className="h-1.5 flex-1 [&_[data-slot=progress-indicator]]:bg-[var(--color-emerald-500)]"
                      />
                      <span className="w-8 shrink-0 text-right text-[0.625rem] tabular-nums text-muted-foreground">
                        {stats.completion}%
                      </span>
                    </div>
                    <ProgressChart
                      buckets={buckets}
                      unit={chartsUnit}
                      isLoading={
                        index >= 0 ? chartQueries[index]?.isLoading : true
                      }
                    />
                    <div className="space-y-2">
                      <h5 className="text-[0.625rem] font-medium text-muted-foreground">
                        {t("unified:charts.statusTitle")}
                      </h5>
                      <StatusDistribution
                        segments={statusSegmentsFor(tasks, backlogLabel)}
                        isLoading={
                          index >= 0 ? taskQueries[index]?.isLoading : true
                        }
                        maxSegments={5}
                      />
                    </div>
                    <div className="space-y-2 border-t border-border/60 pt-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-[0.625rem] font-medium text-muted-foreground">
                          {t("unified:charts.workloadTitle")}
                        </h5>
                        <span className="text-[0.625rem] tabular-nums text-muted-foreground">
                          {t("unified:charts.assigneeCount", {
                            count: stats.assignees,
                          })}
                        </span>
                      </div>
                      <WorkloadChart
                        items={projectWorkload}
                        isLoading={
                          index >= 0 ? taskQueries[index]?.isLoading : true
                        }
                        maxItems={3}
                      />
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
