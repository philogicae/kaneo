import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

export type StatusSegment = {
  name: string;
  count: number;
  /** Column slug, when the caller has one, for a stable semantic color. */
  slug?: string;
};

type StatusDistributionProps = {
  segments: StatusSegment[] | undefined;
  isLoading?: boolean;
  maxSegments?: number;
};

const FALLBACK_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--info)",
] as const;

const STATUS_COLORS: Array<{ match: RegExp; color: string }> = [
  { match: /^(done|complete|closed|finished)/i, color: "var(--success)" },
  { match: /^(in[-_ ]?review|review|qa|verify)/i, color: "var(--warning)" },
  {
    match: /^(in[-_ ]?progress|progress|doing|active|started)/i,
    color: "var(--info)",
  },
  { match: /^(planned|backlog|icebox|someday)/i, color: "var(--chart-4)" },
  { match: /^(archived|trash|cancelled)/i, color: "var(--muted-foreground)" },
  {
    match: /^(to[-_ ]?do|todo|ready|open|new)/i,
    color: "var(--muted-foreground)",
  },
];

function statusRank(segment: StatusSegment) {
  const value = segment.slug ?? segment.name;
  const order = [
    /^(to[-_ ]?do|todo|ready|open|new)/i,
    /^(in[-_ ]?progress|progress|doing|active|started)/i,
    /^(in[-_ ]?review|review|qa|verify)/i,
    /^(done|complete|closed|finished)/i,
    /^(planned|backlog|icebox|someday)/i,
    /^(archived|trash|cancelled)/i,
  ];
  const index = order.findIndex((pattern) => pattern.test(value));
  return index === -1 ? order.length : index;
}

export function statusColor(segment: StatusSegment, index: number) {
  const value = segment.slug ?? segment.name;
  return (
    STATUS_COLORS.find(({ match }) => match.test(value))?.color ??
    FALLBACK_COLORS[index % FALLBACK_COLORS.length]
  );
}

// Horizontal stacked bar + legend: the share each status holds in the board.
// Colors follow the status meaning instead of the legend order, so Done stays
// green and In Review stays amber across every project card.
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
    .sort(
      (left, right) =>
        statusRank(left) - statusRank(right) || right.count - left.count,
    );
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
          {
            name: t("unified:charts.other"),
            count: restCount,
            slug: "other",
          },
        ]
      : visible;

  return (
    <div className="space-y-2.5">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {parts.map((part, index) => (
          <div
            key={part.slug ?? part.name}
            className="h-full min-w-0"
            style={{
              width: `${(part.count / total) * 100}%`,
              backgroundColor: statusColor(part, index),
            }}
            title={`${part.name}: ${part.count} (${Math.round((part.count / total) * 100)}%)`}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[0.625rem] text-muted-foreground">
        {parts.map((part, index) => (
          <li
            key={part.slug ?? part.name}
            className="flex min-w-0 items-center gap-1.5"
          >
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: statusColor(part, index) }}
            />
            <span className="truncate">{part.name}</span>
            <span className="ml-auto shrink-0 tabular-nums text-foreground">
              {Math.round((part.count / total) * 100)}%
            </span>
            <span className="w-6 shrink-0 text-right tabular-nums">
              {part.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
