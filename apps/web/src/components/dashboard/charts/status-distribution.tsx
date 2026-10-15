import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

export type StatusSegment = {
  name: string;
  count: number;
};

type StatusDistributionProps = {
  segments: StatusSegment[] | undefined;
  isLoading?: boolean;
  maxSegments?: number;
};

const SEGMENT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--info)",
] as const;

// Horizontal stacked bar + legend: the share each status holds in the board.
// The bar itself carries native tooltips; the legend shows exact counts.
export default function StatusDistribution({
  segments,
  isLoading,
  maxSegments = 6,
}: StatusDistributionProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  const sorted = [...(segments ?? [])]
    .filter((segment) => segment.count > 0)
    .sort((a, b) => b.count - a.count);
  const total = sorted.reduce((sum, segment) => sum + segment.count, 0);

  if (total === 0) {
    return (
      <div className="flex h-16 items-center justify-center text-xs text-muted-foreground">
        {t("unified:charts.noTasks")}
      </div>
    );
  }

  const visible = sorted.slice(0, maxSegments);
  const rest = sorted.slice(maxSegments);
  const restCount = rest.reduce((sum, segment) => sum + segment.count, 0);
  const parts =
    restCount > 0
      ? [
          ...visible,
          { name: t("unified:charts.other"), count: restCount, isOther: true },
        ]
      : visible;

  return (
    <div className="space-y-2">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {parts.map((part, index) => (
          <div
            key={part.name}
            className="h-full"
            style={{
              width: `${(part.count / total) * 100}%`,
              backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
            }}
            title={`${part.name}: ${part.count}`}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {parts.map((part, index) => (
          <li key={part.name} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
              style={{
                backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
              }}
            />
            <span className="truncate">{part.name}</span>
            <span className="ml-auto tabular-nums text-foreground">
              {part.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
