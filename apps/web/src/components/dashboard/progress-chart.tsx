import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectChartsBucket } from "@/fetchers/project/get-project-charts";
import type { ChartUnit } from "@/store/user-preferences";
import {
  cumulativeBuckets,
  formatBucket,
  formatBucketTick,
  niceMax,
  tickIndexes,
} from "./charts/chart-utils";

type ProgressChartProps = {
  buckets: ProjectChartsBucket[] | undefined;
  unit: ChartUnit;
  isLoading?: boolean;
  height?: number;
};

// Lightweight dependency-free SVG line chart: two cumulative lines (total
// tasks and remaining backlog) over the covered buckets, with adaptive tick
// density based on the render width and a per-bucket hover cursor.
export default function ProgressChart({
  buckets,
  unit,
  isLoading,
  height = 120,
}: ProgressChartProps) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<number | null>(null);

  if (isLoading) {
    return <Skeleton className="w-full" style={{ height }} />;
  }

  if (!buckets || buckets.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted-foreground"
        style={{ height }}
      >
        {t("unified:charts.empty")}
      </div>
    );
  }

  const data = cumulativeBuckets(buckets);
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

  const ticks = tickIndexes(buckets, unit);
  const hoveredPoint = hovered !== null ? data[hovered] : undefined;
  const tooltipLeft =
    hovered !== null
      ? Math.min(90, Math.max(10, ((hovered + 0.5) / data.length) * 100))
      : 0;

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
        <div className="relative min-w-0 flex-1">
          <svg
            aria-hidden="true"
            className="w-full"
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
            {hovered !== null && (
              <line
                className="stroke-border"
                strokeDasharray="2 2"
                strokeWidth="0.5"
                x1={x(hovered)}
                x2={x(hovered)}
                y1={padding.top}
                y2={padding.top + plotHeight}
              />
            )}
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
          {/* Hover columns sit above the SVG so every bucket is a hit target. */}
          <div className="absolute inset-0 flex">
            {data.map((point, index) => (
              // biome-ignore lint/a11y/noStaticElementInteractions: hover-only tooltip cursor over the plot
              <div
                key={point.bucketStart}
                className="h-full flex-1"
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </div>
          {hoveredPoint && (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2"
              style={{ left: `${tooltipLeft}%` }}
            >
              <div className="space-y-0.5 rounded-md border border-border bg-popover px-2 py-1 text-[10px] whitespace-nowrap text-popover-foreground shadow-md">
                <p className="font-medium">
                  {formatBucket(hoveredPoint.bucketStart, unit)}
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-info" />
                  {t("unified:charts.tasks")}: {hoveredPoint.tasks}
                </p>
                <p className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: "var(--chart-2)" }}
                  />
                  {t("unified:charts.backlog")}: {hoveredPoint.backlog}
                </p>
                <p className="text-muted-foreground">
                  {t("unified:charts.created")}: {hoveredPoint.created} ·{" "}
                  {t("unified:charts.completed")}: {hoveredPoint.completed}
                </p>
              </div>
            </div>
          )}
          <div className="relative mt-1 h-3 text-[10px] text-muted-foreground">
            {ticks.map(({ bucket, index }) => (
              <span
                key={bucket.bucketStart}
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${((index + 0.5) / data.length) * 100}%` }}
              >
                {formatBucketTick(bucket.bucketStart, unit)}
              </span>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-4 text-[10px] text-muted-foreground">
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
      </div>
    </div>
  );
}
