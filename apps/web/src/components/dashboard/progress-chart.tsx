import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectChartsBucket } from "@/fetchers/project/get-project-charts";

type ProgressChartProps = {
  buckets: ProjectChartsBucket[] | undefined;
  isLoading?: boolean;
  height?: number;
};

// Scale ceilings with integer halves so the 50% tick label stays clean.
const SCALE_STEPS = [
  2, 4, 6, 8, 12, 16, 20, 30, 40, 60, 80, 100, 150, 200, 300, 500, 1000,
];

function niceMax(value: number) {
  return (
    SCALE_STEPS.find((step) => step >= value) ?? Math.ceil(value / 1000) * 1000
  );
}

function cumulative(buckets: ProjectChartsBucket[]) {
  let created = 0;
  let completed = 0;
  return buckets.map((bucket) => {
    created += bucket.created;
    completed += bucket.completed;
    return {
      weekStart: bucket.weekStart,
      tasks: created,
      // "Backlog" is the remaining work: created minus finished, floored at 0
      // so data gaps (deleted tasks) can't make it negative.
      backlog: Math.max(0, created - completed),
    };
  });
}

// Lightweight dependency-free SVG line chart: two cumulative lines (total
// tasks and remaining backlog) over the covered weeks, with adaptive tick
// density based on the render width.
export default function ProgressChart({
  buckets,
  isLoading,
  height = 120,
}: ProgressChartProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return <Skeleton className="w-full" style={{ height }} />;
  }

  if (!buckets || buckets.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-xs"
        style={{ height }}
      >
        {t("unified:charts.empty")}
      </div>
    );
  }

  const data = cumulative(buckets);
  const width = 100; // viewBox units; the SVG scales to its container.
  const padding = { top: 6, right: 2, bottom: 14, left: 2 };
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = niceMax(
    Math.max(...data.map((point) => Math.max(point.tasks, point.backlog))),
  );

  const x = (index: number) =>
    padding.left +
    (index / Math.max(1, data.length - 1)) *
      (width - padding.left - padding.right);
  const y = (value: number) =>
    padding.top + (1 - value / maxValue) * plotHeight;

  const toPoints = (key: "tasks" | "backlog") =>
    data.map((point, index) => `${x(index)},${y(point[key])}`).join(" ");

  const monthTickIndexes = data
    .map((point, index) => ({ point, index }))
    .filter(
      ({ point, index }, _, arr) =>
        index === 0 ||
        point.weekStart.slice(5, 7) !==
          arr[index - 1]?.point.weekStart.slice(5, 7),
    )
    // Adaptive density: skip labels when they would collide.
    .filter(
      ({ index }, _, all) =>
        all.length <= 7 ||
        index % Math.ceil(all.length / 6) === 0 ||
        index === all.length - 1,
    );

  return (
    <div>
      <div className="flex gap-2">
        {/* Y-axis values, aligned to the plot area (month labels sit below). */}
        <div
          className="flex w-8 shrink-0 flex-col justify-between text-right text-[10px] text-muted-foreground tabular-nums"
          style={{ height: height - padding.bottom }}
        >
          <span>{maxValue}</span>
          <span>{Math.round(maxValue / 2)}</span>
          <span>0</span>
        </div>
        <svg
          aria-hidden="true"
          className="min-w-0 flex-1"
          preserveAspectRatio="none"
          role="img"
          style={{ height }}
          viewBox={`0 0 ${width} ${height}`}
        >
          {/* Horizontal grid at 0%, 50% and 100% of the scale. */}
          {[0, 0.5, 1].map((ratio) => (
            <line
              key={ratio}
              className="stroke-border/60"
              strokeWidth="0.5"
              x1={padding.left}
              x2={width - padding.right}
              y1={padding.top + ratio * plotHeight}
              y2={padding.top + ratio * plotHeight}
            />
          ))}
          <polyline
            className="stroke-info"
            fill="none"
            points={toPoints("tasks")}
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            fill="none"
            points={toPoints("backlog")}
            strokeWidth="1.4"
            style={{ stroke: "var(--chart-2)" }}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="flex justify-between pl-10 text-[10px] text-muted-foreground">
        {monthTickIndexes.map(({ point }) => (
          <span key={point.weekStart}>
            {new Date(`${point.weekStart}T00:00:00Z`).toLocaleDateString(
              undefined,
              { month: "short", timeZone: "UTC" },
            )}
          </span>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-4 pl-10 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 rounded bg-info" />
          {t("unified:charts.tasks")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block h-0.5 w-3 rounded"
            style={{ backgroundColor: "var(--chart-2)" }}
          />
          {t("unified:charts.backlog")}
        </span>
      </div>
    </div>
  );
}
