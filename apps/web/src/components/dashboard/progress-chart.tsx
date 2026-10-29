import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectChartsBucket } from "@/fetchers/project/get-project-charts";
import type { ChartScale, ChartUnit } from "@/store/user-preferences";
import {
  chartAxisMax,
  chartAxisTicks,
  chartRatio,
  compressBuckets,
  cumulativeBuckets,
  formatBucketRange,
  formatBucketTick,
  tickIndexes,
} from "./charts/chart-utils";

type ProgressChartProps = {
  buckets: ProjectChartsBucket[] | undefined;
  unit: ChartUnit;
  scale: ChartScale;
  isLoading?: boolean;
  height?: number;
};

// Lightweight dependency-free SVG line chart: two cumulative lines (remaining
// open work and completed tasks) over the covered buckets, with adaptive tick
// density based on the render width and a per-bucket hover cursor.
export default function ProgressChart({
  buckets,
  unit,
  scale,
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

  const displayBuckets = compressBuckets(buckets);
  const data = cumulativeBuckets(displayBuckets).map((point, index) => ({
    ...point,
    bucketEnd: displayBuckets[index]?.bucketEnd,
  }));
  const width = 100; // viewBox units; the SVG scales to its container.
  const padding = { top: 6, right: 2, bottom: 14, left: 2 };
  const plotHeight = height - padding.top - padding.bottom;
  // Open work is the useful signal: it rises when tasks pile up in To Do,
  // In Progress or In Review, and falls as they move to Done.
  const maxValue = chartAxisMax(
    Math.max(1, ...data.map((point) => Math.max(point.backlog, point.done))),
    scale,
  );
  const yTicks = chartAxisTicks(maxValue, scale);

  const x = (index: number) =>
    padding.left +
    (index / Math.max(1, data.length - 1)) *
      (width - padding.left - padding.right);
  const y = (value: number) =>
    padding.top + (1 - chartRatio(value, maxValue, scale)) * plotHeight;

  const toPoints = (key: "done" | "backlog") =>
    data.map((point, index) => `${x(index)},${y(point[key])}`).join(" ");

  const ticks = tickIndexes(displayBuckets, unit);
  const hoveredPoint = hovered !== null ? data[hovered] : undefined;
  const tooltipLeft =
    hovered !== null
      ? Math.min(90, Math.max(10, ((hovered + 0.5) / data.length) * 100))
      : 0;

  return (
    <div>
      <div className="flex gap-2">
        {/* Y-axis values follow the active scale (log ticks are not evenly
            spaced). */}
        <div
          className="relative w-8 shrink-0 text-right text-[0.625rem] text-muted-foreground tabular-nums"
          style={{ height }}
        >
          {yTicks.map(({ value, ratio }) => (
            <span
              key={value}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: padding.top + (1 - ratio) * plotHeight }}
            >
              {value}
            </span>
          ))}
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
            {/* Horizontal grid at each Y tick. */}
            {yTicks.map(({ value, ratio }) => (
              <line
                key={value}
                className="stroke-border/60"
                strokeWidth="0.5"
                x1={padding.left}
                x2={width - padding.right}
                y1={padding.top + (1 - ratio) * plotHeight}
                y2={padding.top + (1 - ratio) * plotHeight}
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
              fill="none"
              points={toPoints("done")}
              strokeWidth="1.4"
              style={{ stroke: "var(--color-green-500)" }}
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              fill="none"
              points={toPoints("backlog")}
              strokeWidth="1.4"
              style={{ stroke: "var(--color-red-500)" }}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {/* Hover columns sit above the SVG so every bucket is a hit target. */}
          <div className="absolute inset-0 flex">
            {data.map((point, index) => (
              // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- hover-only tooltip cursor over the plot
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
              <div className="space-y-0.5 rounded-md border border-border bg-popover px-2 py-1 text-[0.625rem] whitespace-nowrap text-popover-foreground shadow-md">
                <p className="font-medium">
                  {formatBucketRange(
                    hoveredPoint.bucketStart,
                    hoveredPoint.bucketEnd,
                    unit,
                  )}
                </p>
                <p className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: "var(--color-red-500)" }}
                  />
                  {t("unified:charts.openWork")}: {hoveredPoint.backlog}
                </p>
                <p className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: "var(--color-green-500)" }}
                  />
                  {t("unified:charts.done")}: {hoveredPoint.done}
                </p>
                <p className="text-muted-foreground">
                  {t("unified:charts.created")}: {hoveredPoint.created}
                </p>
              </div>
            </div>
          )}
          <div className="relative mt-1 h-3 text-[0.625rem] text-muted-foreground">
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
          <div className="mt-1 flex items-center gap-4 text-[0.625rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block h-0.5 w-3 rounded"
                style={{ backgroundColor: "var(--color-red-500)" }}
              />
              {t("unified:charts.openWork")}
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block h-0.5 w-3 rounded"
                style={{ backgroundColor: "var(--color-green-500)" }}
              />
              {t("unified:charts.done")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
