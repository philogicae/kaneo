import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectChartsBucket } from "@/fetchers/project/get-project-charts";
import type { ChartUnit } from "@/store/user-preferences";
import {
  formatBucket,
  formatBucketTick,
  niceMax,
  plotMinWidth,
  tickIndexes,
} from "./chart-utils";

type VelocityChartProps = {
  buckets: ProjectChartsBucket[] | undefined;
  unit: ChartUnit;
  isLoading?: boolean;
  height?: number;
};

// Dependency-free bars: tasks created vs completed per bucket, with a hover
// cursor per bucket and a tooltip carrying the raw counts.
export default function VelocityChart({
  buckets,
  unit,
  isLoading,
  height = 150,
}: VelocityChartProps) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<number | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [plotWidth, setPlotWidth] = useState(0);

  // The plot measures itself so dense windows (12 months at day granularity)
  // can switch to horizontal scrolling instead of rendering invisible bars.
  // A callback ref (not an effect) because data can arrive after the first
  // render, so the element mounts later than the component.
  const plotRef = useCallback((element: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!element) return;
    setPlotWidth(element.clientWidth);
    const observer = new ResizeObserver((entries) => {
      setPlotWidth(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(element);
    observerRef.current = observer;
  }, []);

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
  const minWidth = plotMinWidth(buckets.length, plotWidth);

  return (
    <div className="relative">
      <div ref={plotRef} className="overflow-x-auto">
        <div className="relative" style={minWidth ? { minWidth } : undefined}>
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
                    key={bucket.bucketStart}
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
            {tickIndexes(buckets, unit).map(({ bucket, index }) => (
              <span
                key={bucket.bucketStart}
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${((index + 0.5) / buckets.length) * 100}%` }}
              >
                {formatBucketTick(bucket.bucketStart, unit)}
              </span>
            ))}
          </div>

          {hoveredBucket && (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2"
              style={{ left: `${tooltipLeft}%` }}
            >
              <div className="space-y-0.5 rounded-md border border-border bg-popover px-2 py-1 text-[10px] whitespace-nowrap text-popover-foreground shadow-md">
                <p className="font-medium">
                  {formatBucket(hoveredBucket.bucketStart, unit)}
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
        </div>
      </div>

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
