import type Milestone from "@/types/milestone";
import type Task from "@/types/task";

// Roadmap layout: milestones become left-to-right zones, tasks become compact
// nodes ordered inside their zone so dependencies flow rightwards and
// downwards, and edges carry the progression state (a done source "lights
// up" its outgoing branches). Pure functions so the geometry is unit-testable
// without a browser.

export const ZONE_WIDTH = 288;
export const ZONE_GAP = 16;
export const ZONE_HEADER_HEIGHT = 52;
export const NODE_WIDTH = 248;
export const NODE_HEIGHT = 56;
export const NODE_GAP_Y = 12;
export const GRAPH_PADDING = 20;

export type RoadmapTask = Pick<
  Task,
  "id" | "title" | "status" | "priority" | "milestoneId" | "position"
> & {
  number?: number | null;
  assigneeName?: string | null;
  labelNames?: string[];
};

export type RoadmapRelation = {
  sourceTaskId: string;
  targetTaskId: string;
  // "blocks" (source blocks target) and "subtask" (source parent, target
  // child) are directed; "related" is undirected and ignored.
  relationType: string;
};

export type RoadmapNodeState = "done" | "active" | "blocked" | "todo";
export type RoadmapEdgeState = "lit" | "active" | "muted";

export type RoadmapZone = {
  // null is the leading "no sprint" lane so unassigned work stays visible.
  milestoneId: string | null;
  name: string;
  color: string;
  x: number;
  width: number;
  taskCount: number;
  completedCount: number;
};

export type RoadmapNode = {
  id: string;
  taskId: string;
  title: string;
  status: string;
  priority: string | null;
  milestoneId: string | null;
  assigneeName: string | null;
  labelNames: string[];
  number: number | null;
  state: RoadmapNodeState;
  x: number;
  y: number;
  width: number;
  height: number;
  onCriticalPath: boolean;
};

export type RoadmapEdge = {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  path: string;
  state: RoadmapEdgeState;
  onCriticalPath: boolean;
};

export type RoadmapGraph = {
  zones: RoadmapZone[];
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
  width: number;
  height: number;
};

export type RoadmapInput = {
  tasks: RoadmapTask[];
  milestones: Array<Pick<Milestone, "id" | "name" | "color" | "position">>;
  relations: RoadmapRelation[];
  // Column slugs that count as finished (isFinal columns).
  finalStatuses: ReadonlySet<string>;
};

const DIRECTED_RELATIONS = new Set(["blocks", "subtask"]);

// Longest-path depth per task over the directed graph, ignoring back edges so
// a cycle cannot loop forever. Shared by row ordering and the critical path.
function dependencyDepths(
  ids: string[],
  edges: Array<{ source: string; target: string }>,
): {
  depths: Map<string, number>;
  order: string[];
} {
  const outgoing = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();
  const idSet = new Set(ids);
  for (const id of ids) {
    outgoing.set(id, []);
    incomingCount.set(id, 0);
  }
  for (const edge of edges) {
    if (!idSet.has(edge.source) || !idSet.has(edge.target)) continue;
    outgoing.get(edge.source)?.push(edge.target);
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
  }

  // Kahn's algorithm gives a topological order; anything left over sits on a
  // cycle and is appended as-is (depth falls back to 0).
  const queue = ids.filter((id) => (incomingCount.get(id) ?? 0) === 0);
  const order: string[] = [];
  const remaining = new Map(incomingCount);
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) break;
    order.push(id);
    for (const next of outgoing.get(id) ?? []) {
      const left = (remaining.get(next) ?? 0) - 1;
      remaining.set(next, left);
      if (left === 0) queue.push(next);
    }
  }
  const ordered = new Set(order);
  for (const id of ids) {
    if (!ordered.has(id)) order.push(id);
  }

  const depths = new Map<string, number>();
  for (const id of order) {
    const incoming = edges.filter((edge) => edge.target === id);
    const depth = incoming.reduce(
      (max, edge) => Math.max(max, (depths.get(edge.source) ?? 0) + 1),
      0,
    );
    depths.set(id, depth);
  }

  return { depths, order };
}

function findCriticalPath(
  ids: string[],
  edges: Array<{ source: string; target: string }>,
): { nodeIds: Set<string>; edgeKeys: Set<string> } {
  const { order } = dependencyDepths(ids, edges);
  const depth = new Map<string, number>();
  const parent = new Map<string, string | null>();

  for (const id of order) {
    let best = 0;
    let bestParent: string | null = null;
    for (const edge of edges) {
      if (edge.target !== id) continue;
      const candidate = (depth.get(edge.source) ?? 0) + 1;
      if (candidate > best) {
        best = candidate;
        bestParent = edge.source;
      }
    }
    depth.set(id, best);
    parent.set(id, bestParent);
  }

  let end: string | null = null;
  for (const id of ids) {
    if (end === null || (depth.get(id) ?? 0) > (depth.get(end) ?? 0)) {
      end = id;
    }
  }

  const nodeIds = new Set<string>();
  const edgeKeys = new Set<string>();
  let cursor = end;
  // A dependency cycle can make the parent chain loop; stop at the first
  // repeat instead of walking forever.
  while (cursor && !nodeIds.has(cursor)) {
    nodeIds.add(cursor);
    const previous = parent.get(cursor) ?? null;
    if (previous) {
      edgeKeys.add(`${previous}->${cursor}`);
    }
    cursor = previous;
  }

  return { nodeIds, edgeKeys };
}

function edgePath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): string {
  const control = Math.max(24, Math.abs(toX - fromX) / 2);
  return `M ${fromX} ${fromY} C ${fromX + control} ${fromY}, ${toX - control} ${toY}, ${toX} ${toY}`;
}

// A dependency that points left (a later sprint blocking an earlier one)
// cannot be drawn as a straight side curve without crossing the nodes in
// between: route it below both cards as a U instead.
function backwardEdgePath(source: RoadmapNode, target: RoadmapNode): string {
  const startX = source.x + source.width / 2;
  const startY = source.y + source.height;
  const endX = target.x + target.width / 2;
  const endY = target.y + target.height;
  const below = Math.max(startY, endY) + 28;
  return `M ${startX} ${startY} C ${startX} ${below}, ${endX} ${below}, ${endX} ${endY}`;
}

export function buildRoadmapGraph(input: RoadmapInput): RoadmapGraph {
  const { tasks, milestones, relations, finalStatuses } = input;

  // Zone order: the no-sprint lane first, then milestones by position.
  const orderedMilestones = [...milestones].sort(
    (a, b) => a.position - b.position,
  );
  const hasUnassigned = tasks.some((task) => !task.milestoneId);
  const zoneOrder: Array<{
    milestoneId: string | null;
    name: string;
    color: string;
  }> = [
    ...(hasUnassigned ? [{ milestoneId: null, name: "", color: "gray" }] : []),
    ...orderedMilestones.map((milestone) => ({
      milestoneId: milestone.id,
      name: milestone.name,
      color: milestone.color,
    })),
  ];

  const directedEdges = relations
    .filter((relation) => DIRECTED_RELATIONS.has(relation.relationType))
    .map((relation) => ({
      source: relation.sourceTaskId,
      target: relation.targetTaskId,
    }))
    .filter(
      (edge) =>
        tasks.some((task) => task.id === edge.source) &&
        tasks.some((task) => task.id === edge.target),
    );

  const taskIds = tasks.map((task) => task.id);
  const { depths } = dependencyDepths(taskIds, directedEdges);
  const critical = findCriticalPath(taskIds, directedEdges);

  const tasksByZone = new Map<string, RoadmapTask[]>();
  for (const task of tasks) {
    const key = task.milestoneId ?? "";
    const list = tasksByZone.get(key) ?? [];
    list.push(task);
    tasksByZone.set(key, list);
  }

  const isDone = (task: RoadmapTask) =>
    finalStatuses.has(task.status) || task.status === "archived";
  const doneById = new Map(tasks.map((task) => [task.id, isDone(task)]));

  const nodes: RoadmapNode[] = [];
  const zones: RoadmapZone[] = [];

  let zoneX = GRAPH_PADDING;
  let maxRows = 0;
  for (const zone of zoneOrder) {
    const zoneTasks = tasksByZone.get(zone.milestoneId ?? "") ?? [];
    const ordered = [...zoneTasks].sort((a, b) => {
      const depthDelta = (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0);
      if (depthDelta !== 0) return depthDelta;
      const positionDelta = (a.position ?? 0) - (b.position ?? 0);
      if (positionDelta !== 0) return positionDelta;
      return (a.number ?? 0) - (b.number ?? 0);
    });

    const completedCount = ordered.filter(isDone).length;
    zones.push({
      milestoneId: zone.milestoneId,
      name: zone.name,
      color: zone.color,
      x: zoneX,
      width: ZONE_WIDTH,
      taskCount: ordered.length,
      completedCount,
    });
    maxRows = Math.max(maxRows, ordered.length);

    ordered.forEach((task, index) => {
      const hasUnfinishedBlocker = directedEdges.some(
        (edge) =>
          edge.target === task.id && !(doneById.get(edge.source) ?? false),
      );
      const state: RoadmapNodeState = isDone(task)
        ? "done"
        : hasUnfinishedBlocker
          ? "blocked"
          : task.status === "in-progress"
            ? "active"
            : "todo";

      nodes.push({
        id: `node-${task.id}`,
        taskId: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority ?? null,
        milestoneId: task.milestoneId ?? null,
        assigneeName: task.assigneeName ?? null,
        labelNames: task.labelNames ?? [],
        number: task.number ?? null,
        state,
        x: zoneX + (ZONE_WIDTH - NODE_WIDTH) / 2,
        y:
          GRAPH_PADDING +
          ZONE_HEADER_HEIGHT +
          index * (NODE_HEIGHT + NODE_GAP_Y),
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        onCriticalPath: critical.nodeIds.has(task.id),
      });
    });

    zoneX += ZONE_WIDTH + ZONE_GAP;
  }

  const nodeByTask = new Map(nodes.map((node) => [node.taskId, node]));
  const edges: RoadmapEdge[] = [];
  for (const edge of directedEdges) {
    const source = nodeByTask.get(edge.source);
    const target = nodeByTask.get(edge.target);
    if (!source || !target) continue;
    const key = `${edge.source}->${edge.target}`;
    const state: RoadmapEdgeState =
      (doneById.get(edge.source) ?? false)
        ? "lit"
        : source.state === "active"
          ? "active"
          : "muted";
    edges.push({
      id: `edge-${key}`,
      sourceTaskId: edge.source,
      targetTaskId: edge.target,
      path:
        target.x <= source.x
          ? backwardEdgePath(source, target)
          : edgePath(
              source.x + source.width,
              source.y + source.height / 2,
              target.x,
              target.y + target.height / 2,
            ),
      state,
      onCriticalPath: critical.edgeKeys.has(key),
    });
  }

  const zoneCount = Math.max(zoneOrder.length, 1);
  const width =
    GRAPH_PADDING * 2 + zoneCount * ZONE_WIDTH + (zoneCount - 1) * ZONE_GAP;
  const height =
    GRAPH_PADDING * 2 +
    ZONE_HEADER_HEIGHT +
    Math.max(maxRows, 1) * (NODE_HEIGHT + NODE_GAP_Y);

  return { zones, nodes, edges, width, height };
}
