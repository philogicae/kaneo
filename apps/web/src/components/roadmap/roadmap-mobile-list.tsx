import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { resolveLabelColor } from "@/lib/label-color";
import type { RoadmapGraph, RoadmapNodeState } from "@/lib/roadmap-layout";
import type { RoadmapFilter } from "./roadmap-graph";

type RoadmapMobileListProps = {
  graph: RoadmapGraph;
  filter: RoadmapFilter;
  onOpenTask: (taskId: string) => void;
};

const STATE_DOT: Record<RoadmapNodeState, string> = {
  done: "bg-success",
  active: "bg-primary",
  blocked: "bg-warning",
  todo: "bg-muted-foreground",
};

// Mirrors the graph's nodeMatchesFilter so both layouts show the same tasks
// when a status filter is active.
function nodeMatchesFilter(
  state: RoadmapNodeState,
  filter: RoadmapFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "active") return state === "active" || state === "done";
  return state === "blocked";
}

// Narrow screens cannot pan the SVG canvas comfortably, so the roadmap falls
// back to one list per sprint (see the design note in the roadmap study).
export default function RoadmapMobileList({
  graph,
  filter,
  onOpenTask,
}: RoadmapMobileListProps) {
  const { t } = useTranslation();

  return (
    <div className="h-full overflow-y-auto rounded-lg border border-border bg-background">
      {graph.zones.map((zone) => {
        const nodes = graph.nodes.filter(
          (node) =>
            node.milestoneId === zone.milestoneId &&
            nodeMatchesFilter(node.state, filter),
        );
        const color = resolveLabelColor(zone.color);
        return (
          <section
            key={zone.milestoneId ?? "__none__"}
            className="border-b border-border/60 last:border-b-0"
          >
            <header className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate text-sm font-semibold">
                  {zone.name || t("roadmap:noSprint")}
                </span>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                {t("roadmap:zoneProgress", {
                  completed: zone.completedCount,
                  count: zone.taskCount,
                })}
              </span>
            </header>
            <ul className="pb-1">
              {nodes.map((node) => {
                const meta = [
                  node.assigneeName,
                  ...(node.labelNames ?? []).slice(0, 2),
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={node.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-accent"
                      onClick={() => onOpenTask(node.taskId)}
                    >
                      <span
                        className={cn(
                          "mt-1 size-2 shrink-0 rounded-full",
                          STATE_DOT[node.state],
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {node.number ? (
                            <span className="font-mono">#{node.number}</span>
                          ) : null}
                          <span>{t(`roadmap:state.${node.state}`)}</span>
                        </span>
                        <span className="block truncate text-xs font-medium">
                          {node.title}
                        </span>
                        {meta ? (
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {meta}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
