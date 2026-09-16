import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectChartsBucket } from "@/fetchers/project/get-project-charts";
import {
  formatMonth,
  formatWeekStart,
  monthTickIndexes,
  niceMax,
} from "./chart-utils";

type VelocityChartProps = {
  buckets: ProjectChartsBucket[] | undefined;
  isLoading?: boolean;
  height?: number;
};

// Dependency-free weekly bars: tasks created vs completed per week, with a
// hover cursor per week and a tooltip carrying the raw counts.
export default function VelocityChart({
  buckets,
  isLoading,
  height = 150,
}: VelocityChartProps) {
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

  const plotHeight = height - 16;
  const maxValue = niceMax(
    Math.max(
      1,
      ...buckets.map((bucket) => Math.max(bucket.created, bucket.completed)),
    ),
  );
  const barHeight = (value: number) =>
    value <= 0 ? 0 : Math.max(2, (value / maxValue) * plotHeight);

  const hoveredBucket = hovered !== null ? buckets[hovered] : undefined;
  const tooltipLeft =
    hovered !== null
      ? Math.min(90, Math.max(10, ((hovered + 0.5) / buckets.length) * 100))
      : 0;

  return (
    <div className="relative">
      <div className="relative" style={{ height }}>
        <div
          className="absolute inset-x-0 top-0"
          style={{ height: plotHeight }}
        >
          {[0, 0.5, 1].map((ratio) => (
            <div
              key={ratio}
              className="absolute inset-x-0 border-t border-border/60"
              style={{ top: ratio * plotHeight }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-px">
            {buckets.map((bucket, index) => (
              // biome-ignore lint/a11y/noStaticElementInteractions: hover-only tooltip cursor over the bars
              <div
                key={bucket.weekStart}
                className="flex h-full flex-1 items-end justify-center gap-px"
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
              >
                <div
                  className="w-[38%] max-w-3 rounded-t-[2px] bg-info"
                  style={{ height: barHeight(bucket.created) }}
                />
                <div
                  className="w-[38%] max-w-3 rounded-t-[2px] bg-chart-2"
                  style={{ height: barHeight(bucket.completed) }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="relative mt-1 h-3 text-[10px] text-muted-foreground">
        {monthTickIndexes(buckets).map(({ bucket, index }) => (
          <span
            key={bucket.weekStart}
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${((index + 0.5) / buckets.length) * 100}%` }}
          >
            {formatMonth(bucket.weekStart)}
          </span>
        ))}
      </div>

      {hoveredBucket && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-2"
          style={{ left: `${tooltipLeft}%` }}
        >
          <div className="space-y-0.5 rounded-md border border-border bg-popover px-2 py-1 text-[10px] whitespace-nowrap text-popover-foreground shadow-md">
            <p className="font-medium">
              {formatWeekStart(hoveredBucket.weekStart)}
            </p>
            <p className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-info" />
              {t("unified:charts.created")}: {hoveredBucket.created}
            </p>
            <p className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-chart-2" />
              {t("unified:charts.completed")}: {hoveredBucket.completed}
            </p>
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-[2px] bg-info" />
          {t("unified:charts.created")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-[2px] bg-chart-2" />
          {t("unified:charts.completed")}
        </span>
      </div>
    </div>
  );
}
