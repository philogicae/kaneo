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
  formatBucketRange,
  formatBucketTick,
  tickIndexes,
} from "./chart-utils";

type VelocityChartProps = {
  buckets: ProjectChartsBucket[] | undefined;
  unit: ChartUnit;
  scale: ChartScale;
  isLoading?: boolean;
  height?: number;
};

// Dependency-free bars: tasks created vs completed per bucket, with a hover
// cursor per bucket and a tooltip carrying the raw counts.
export default function VelocityChart({
  buckets,
  unit,
  scale,
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

  const displayBuckets = compressBuckets(buckets);
  const maxValue = chartAxisMax(
    Math.max(
      1,
      ...displayBuckets.map((bucket) =>
        Math.max(bucket.created, bucket.completed),
      ),
    ),
    scale,
  );
  const yTicks = chartAxisTicks(maxValue, scale);
  const barHeight = (value: number) =>
    value <= 0 ? 0 : Math.max(2, chartRatio(value, maxValue, scale) * height);

  const hoveredBucket = hovered !== null ? displayBuckets[hovered] : undefined;
  const tooltipLeft =
    hovered !== null
      ? Math.min(
          90,
          Math.max(10, ((hovered + 0.5) / displayBuckets.length) * 100),
        )
      : 0;

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div
          className="relative w-8 shrink-0 text-right text-[0.625rem] text-muted-foreground tabular-nums"
          style={{ height }}
        >
          {yTicks.map(({ value, ratio }) => (
            <span
              key={value}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: (1 - ratio) * height }}
            >
              {value}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            <div className="absolute inset-x-0 top-0" style={{ height }}>
              {yTicks.map(({ value, ratio }) => (
                <div
                  key={value}
                  className="absolute inset-x-0 border-t border-border/60"
                  style={{ top: (1 - ratio) * height }}
                />
              ))}
              <div className="absolute inset-0 flex items-end gap-px">
                {displayBuckets.map((bucket, index) => (
                  // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- hover-only tooltip cursor over the bars
                  <div
                    key={bucket.bucketStart}
                    className="flex h-full min-w-0 flex-1 items-end justify-center gap-px"
                    onMouseEnter={() => setHovered(index)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <div
                      className="w-[44%] max-w-3 rounded-t-[2px]"
                      style={{
                        height: barHeight(bucket.created),
                        backgroundColor: "var(--color-sky-500)",
                      }}
                    />
                    <div
                      className="w-[44%] max-w-3 rounded-t-[2px]"
                      style={{
                        height: barHeight(bucket.completed),
                        backgroundColor: "var(--color-emerald-500)",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="relative mt-1 h-3 text-[0.625rem] text-muted-foreground">
            {tickIndexes(displayBuckets, unit).map(({ bucket, index }) => (
              <span
                key={bucket.bucketStart}
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{
                  left: `${((index + 0.5) / displayBuckets.length) * 100}%`,
                }}
              >
                {formatBucketTick(bucket.bucketStart, unit)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {hoveredBucket && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2"
          style={{ left: `${tooltipLeft}%` }}
        >
          <div className="space-y-0.5 rounded-md border border-border bg-popover px-2 py-1 text-[0.625rem] whitespace-nowrap text-popover-foreground shadow-md">
            <p className="font-medium">
              {formatBucketRange(
                hoveredBucket.bucketStart,
                hoveredBucket.bucketEnd,
                unit,
              )}
            </p>
            <p className="flex items-center gap-1.5">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "var(--color-sky-500)" }}
              />
              {t("unified:charts.created")}: {hoveredBucket.created}
            </p>
            <p className="flex items-center gap-1.5">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "var(--color-emerald-500)" }}
              />
              {t("unified:charts.completed")}: {hoveredBucket.completed}
            </p>
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center gap-4 text-[0.625rem] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-[2px]"
            style={{ backgroundColor: "var(--color-sky-500)" }}
          />
          {t("unified:charts.created")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-[2px]"
            style={{ backgroundColor: "var(--color-emerald-500)" }}
          />
          {t("unified:charts.completed")}
        </span>
      </div>
    </div>
  );
}
