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
  useUserPreferencesStore,
} from "@/store/user-preferences";
import { aggregateBuckets, averageCompleted } from "./chart-utils";
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

  const unitOptions = CHART_UNITS_BY_RANGE[chartsRange];

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

  return (
    <div className="flex flex-col gap-4">
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
              onValueChange={(value) => {
                if (isChartUnit(value) && unitOptions.includes(value)) {
                  setChartsUnit(value);
                }
              }}
            >
              <SelectTrigger
                aria-label={t("unified:charts.unit")}
                className="min-w-24"
                size="sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_UNIT_OPTIONS.map((unit) => (
                  <SelectItem
                    key={unit}
                    disabled={!unitOptions.includes(unit)}
                    value={unit}
                  >
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
                label={t("unified:charts.average")}
                value={t("unified:charts.perUnit", {
                  value: velocity.toFixed(1),
                  unit: velocityUnit,
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
                        label={t("unified:charts.average")}
                        value={t("unified:charts.perUnit", {
                          value: averageCompleted(buckets ?? []).toFixed(1),
                          unit: velocityUnit,
                        })}
                      />
                    </div>
                    <ProgressChart
                      buckets={buckets}
                      unit={chartsUnit}
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
