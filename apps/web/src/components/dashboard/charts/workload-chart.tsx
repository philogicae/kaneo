import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/get-initials";

export type WorkloadItem = {
  id: string;
  name: string;
  count: number;
  image?: string | null;
};

type WorkloadChartProps = {
  items: WorkloadItem[] | undefined;
  isLoading?: boolean;
  maxItems?: number;
};

// Who is carrying the open board work: one row per assignee, bar scaled to
// the busiest one. Unassigned work keeps its own row.
export default function WorkloadChart({
  items,
  isLoading,
  maxItems = 8,
}: WorkloadChartProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  const sorted = [...(items ?? [])]
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  if (sorted.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        {t("unified:charts.workloadEmpty")}
      </div>
    );
  }

  const visible = sorted.slice(0, maxItems);
  const max = Math.max(1, ...visible.map((item) => item.count));

  return (
    <ul className="space-y-2.5">
      {visible.map((item) => (
        <li key={item.id} className="flex items-center gap-2 text-xs">
          <Avatar className="size-5 shrink-0">
            <AvatarImage src={item.image ?? undefined} alt={item.name} />
            <AvatarFallback className="text-[10px]">
              {getInitials(item.name, "—")}
            </AvatarFallback>
          </Avatar>
          <span className="w-24 shrink-0 truncate" title={item.name}>
            {item.name}
          </span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-info"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </span>
          <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">
            {item.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
