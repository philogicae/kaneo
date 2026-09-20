import { Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { resolveLabelColor } from "@/lib/label-color";
import type {
  RoadmapEdgeState,
  RoadmapGraph as RoadmapGraphData,
  RoadmapNodeState,
} from "@/lib/roadmap-layout";

export type RoadmapFilter = "all" | "active" | "blocked";

type RoadmapGraphProps = {
  graph: RoadmapGraphData;
  filter: RoadmapFilter;
  onOpenTask: (taskId: string) => void;
};

const NODE_STATE_CLASS: Record<RoadmapNodeState, string> = {
  done: "stroke-success",
  active: "stroke-primary",
  blocked: "stroke-warning",
  todo: "stroke-border",
};

const NODE_STATE_DOT: Record<RoadmapNodeState, string> = {
  done: "fill-success",
  active: "fill-primary",
  blocked: "fill-warning",
  todo: "fill-muted-foreground",
};

const EDGE_STATE_CLASS: Record<RoadmapEdgeState, string> = {
  lit: "stroke-success",
  active: "stroke-primary",
  muted: "stroke-border",
};

function truncate(text: string, max = 30): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function nodeMatchesFilter(
  state: RoadmapNodeState,
  filter: RoadmapFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "active") return state === "active" || state === "done";
  return state === "blocked";
}

export default function RoadmapGraph({
  graph,
  filter,
  onOpenTask,
}: RoadmapGraphProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [hovered, setHovered] = useState<string | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    viewX: number;
    viewY: number;
    moved: boolean;
  } | null>(null);
  // Fitting is automatic until the user pans or zooms; from then on their
  // view wins.
  const fittedWidthRef = useRef<number | null>(null);
  const userInteractedRef = useRef(false);

  // Wheel zoom needs a non-passive listener, otherwise the page scrolls while
  // zooming over the graph.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      userInteractedRef.current = true;
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      setView((current) => ({
        ...current,
        k: Math.min(2.5, Math.max(0.4, current.k * factor)),
      }));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  // Wide graphs start clipped on first paint; scale them down to fit so the
  // whole roadmap is visible without an initial pan. The milestones query can
  // resolve after the board and widen the graph a moment later, so the fit
  // re-runs on every width change until the user pans or zooms; after that it
  // never fights their view.
  const fitToWidth = useCallback(() => {
    const element = containerRef.current;
    if (!element || graph.width === 0) return;
    const available = element.clientWidth - 16;
    if (available > 0 && graph.width > available) {
      setView({ x: 8, y: 8, k: Math.max(0.4, available / graph.width) });
      return;
    }
    setView({ x: 0, y: 0, k: 1 });
  }, [graph.width]);

  useEffect(() => {
    if (graph.width === 0) return;
    if (userInteractedRef.current || fittedWidthRef.current === graph.width) {
      return;
    }
    fittedWidthRef.current = graph.width;
    fitToWidth();
  }, [graph.width, fitToWidth]);

  const neighborIds = useMemo(() => {
    if (!hovered) return null;
    const ids = new Set<string>([hovered]);
    for (const edge of graph.edges) {
      if (edge.sourceTaskId === hovered) ids.add(edge.targetTaskId);
      if (edge.targetTaskId === hovered) ids.add(edge.sourceTaskId);
    }
    return ids;
  }, [graph.edges, hovered]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // No pointer capture: capturing redirects the follow-up click to the
    // container, which would swallow a plain click on a node.
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      viewX: view.x,
      viewY: view.y,
      moved: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      drag.moved = true;
      userInteractedRef.current = true;
    }
    setView((current) => ({
      ...current,
      x: drag.viewX + dx,
      y: drag.viewY + dy,
    }));
  };

  const handlePointerUp = () => {
    // Keep `moved` readable by the click handler that fires right after this.
    const drag = dragRef.current;
    window.setTimeout(() => {
      if (dragRef.current === drag) {
        dragRef.current = null;
      }
    }, 0);
  };

  const handleNodeClick = (taskId: string) => {
    if (dragRef.current?.moved) return;
    onOpenTask(taskId);
  };

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-lg border border-border bg-background">
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          aria-label={t("roadmap:zoomIn")}
          onClick={() => {
            userInteractedRef.current = true;
            setView((current) => ({
              ...current,
              k: Math.min(2.5, current.k * 1.2),
            }));
          }}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          aria-label={t("roadmap:zoomOut")}
          onClick={() => {
            userInteractedRef.current = true;
            setView((current) => ({
              ...current,
              k: Math.max(0.4, current.k / 1.2),
            }));
          }}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          aria-label={t("roadmap:resetView")}
          onClick={() => {
            // Reset means "show me everything again": re-fit and let later
            // width changes (a new sprint) re-fit as well.
            userInteractedRef.current = false;
            fittedWidthRef.current = null;
            fitToWidth();
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div
        ref={containerRef}
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <svg
          className="h-full w-full select-none"
          data-testid="roadmap-svg"
          role="img"
          aria-label={t("roadmap:graphLabel")}
        >
          <g
            transform={`translate(${view.x} ${view.y}) scale(${view.k})`}
            style={{ transformOrigin: "0 0" }}
          >
            {graph.zones.map((zone) => {
              const color = resolveLabelColor(zone.color);
              const ratio =
                zone.taskCount > 0 ? zone.completedCount / zone.taskCount : 0;
              return (
                <g key={zone.milestoneId ?? "__none__"}>
                  <rect
                    x={zone.x}
                    y={0}
                    width={zone.width}
                    height={graph.height}
                    rx={12}
                    style={{ stroke: color, fill: color }}
                    fillOpacity={0.06}
                    strokeOpacity={0.35}
                  />
                  <text
                    x={zone.x + 12}
                    y={22}
                    className="fill-foreground text-[12px] font-semibold"
                  >
                    {zone.name || t("roadmap:noSprint")}
                  </text>
                  <text
                    x={zone.x + 12}
                    y={40}
                    className="fill-muted-foreground text-[11px]"
                  >
                    {t("roadmap:zoneProgress", {
                      completed: zone.completedCount,
                      count: zone.taskCount,
                    })}
                  </text>
                  <rect
                    x={zone.x + zone.width - 72}
                    y={30}
                    width={60}
                    height={4}
                    rx={2}
                    className="fill-muted"
                  />
                  <rect
                    x={zone.x + zone.width - 72}
                    y={30}
                    width={60 * ratio}
                    height={4}
                    rx={2}
                    style={{ fill: color }}
                  />
                </g>
              );
            })}

            {graph.edges.map((edge) => {
              const dimmedByFilter =
                filter !== "all" &&
                !graph.nodes.some(
                  (node) =>
                    node.taskId === edge.sourceTaskId &&
                    nodeMatchesFilter(node.state, filter),
                );
              const dimmedByHover =
                neighborIds !== null &&
                !(
                  neighborIds.has(edge.sourceTaskId) &&
                  neighborIds.has(edge.targetTaskId)
                );
              return (
                <path
                  key={edge.id}
                  d={edge.path}
                  fill="none"
                  strokeWidth={edge.onCriticalPath ? 2.5 : 1.5}
                  className={cn(
                    EDGE_STATE_CLASS[edge.state],
                    (dimmedByFilter || dimmedByHover) && "opacity-15",
                  )}
                  strokeOpacity={edge.state === "muted" ? 0.6 : 0.9}
                  markerEnd="url(#roadmap-arrow)"
                />
              );
            })}

            <defs>
              <marker
                id="roadmap-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-border" />
              </marker>
            </defs>

            {graph.nodes.map((node) => {
              const matches = nodeMatchesFilter(node.state, filter);
              const dimmedByHover =
                neighborIds !== null && !neighborIds.has(node.taskId);
              const dimmed = !matches || dimmedByHover;
              return (
                // biome-ignore lint/a11y/useSemanticElements: SVG nodes have no <button>; the group carries role/keyboard handling
                <g
                  key={node.id}
                  transform={`translate(${node.x} ${node.y})`}
                  className={cn(
                    "cursor-pointer transition-opacity",
                    dimmed && "opacity-20",
                  )}
                  role="button"
                  tabIndex={0}
                  aria-label={node.title}
                  onPointerEnter={() => setHovered(node.taskId)}
                  onPointerLeave={() => setHovered(null)}
                  onClick={() => handleNodeClick(node.taskId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleNodeClick(node.taskId);
                    }
                  }}
                >
                  <title>{node.title}</title>
                  <rect
                    width={node.width}
                    height={node.height}
                    rx={10}
                    strokeWidth={node.onCriticalPath ? 2 : 1}
                    className={cn("fill-card", NODE_STATE_CLASS[node.state])}
                  />
                  <circle
                    cx={14}
                    cy={18}
                    r={4}
                    className={NODE_STATE_DOT[node.state]}
                  />
                  <text
                    x={24}
                    y={22}
                    className="fill-muted-foreground text-[10px] font-mono"
                  >
                    {node.number ? `#${node.number}` : ""}
                  </text>
                  <text
                    x={12}
                    y={38}
                    className="fill-foreground text-[12px] font-medium"
                  >
                    {truncate(node.title)}
                  </text>
                  <text
                    x={12}
                    y={50}
                    className="fill-muted-foreground text-[10px]"
                  >
                    {[node.assigneeName, ...(node.labelNames ?? []).slice(0, 2)]
                      .filter(Boolean)
                      .join(" · ")}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
