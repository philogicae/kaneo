import { describe, expect, it } from "vitest";
import {
  buildRoadmapGraph,
  type RoadmapInput,
  type RoadmapTask,
} from "@/lib/roadmap-layout";

function task(id: string, overrides: Partial<RoadmapTask> = {}): RoadmapTask {
  return {
    id,
    title: `Task ${id}`,
    status: "to-do",
    priority: "medium",
    milestoneId: null,
    position: 0,
    number: 1,
    ...overrides,
  };
}

const milestoneA = { id: "m1", name: "Sprint 1", color: "sky", position: 0 };
const milestoneB = { id: "m2", name: "Sprint 2", color: "teal", position: 1 };

function build(overrides: Partial<RoadmapInput> = {}) {
  return buildRoadmapGraph({
    tasks: [],
    milestones: [],
    relations: [],
    finalStatuses: new Set(["done"]),
    ...overrides,
  });
}

describe("buildRoadmapGraph", () => {
  it("puts the no-sprint lane first and zones left to right by position", () => {
    const graph = build({
      tasks: [
        task("a", { milestoneId: "m1", number: 1 }),
        task("b", { milestoneId: null, number: 2 }),
        task("c", { milestoneId: "m2", number: 3 }),
      ],
      milestones: [milestoneB, milestoneA],
    });

    expect(graph.zones.map((zone) => zone.milestoneId)).toEqual([
      null,
      "m1",
      "m2",
    ]);
    const xById = new Map(graph.nodes.map((node) => [node.taskId, node.x]));
    expect(xById.get("b")).toBeLessThan(xById.get("a") ?? 0);
    expect(xById.get("a")).toBeLessThan(xById.get("c") ?? 0);
  });

  it("orders rows so a blocker sits before the task it blocks", () => {
    const graph = build({
      tasks: [
        task("blocked", { milestoneId: "m1", position: 0 }),
        task("blocker", { milestoneId: "m1", position: 1 }),
      ],
      milestones: [milestoneA],
      relations: [
        {
          sourceTaskId: "blocker",
          targetTaskId: "blocked",
          relationType: "blocks",
        },
      ],
    });

    const yById = new Map(graph.nodes.map((node) => [node.taskId, node.y]));
    expect(yById.get("blocker")).toBeLessThan(yById.get("blocked") ?? 0);
  });

  it("derives node states from final columns and blockers", () => {
    const graph = build({
      tasks: [
        task("done", { status: "done" }),
        task("blocked"),
        task("active", { status: "in-progress" }),
        task("todo"),
      ],
      relations: [
        {
          sourceTaskId: "todo",
          targetTaskId: "blocked",
          relationType: "blocks",
        },
      ],
    });

    const stateById = new Map(
      graph.nodes.map((node) => [node.taskId, node.state]),
    );
    expect(stateById.get("done")).toBe("done");
    expect(stateById.get("blocked")).toBe("blocked");
    expect(stateById.get("active")).toBe("active");
    expect(stateById.get("todo")).toBe("todo");
  });

  it("lights edges from done sources and ignores related relations", () => {
    const graph = build({
      tasks: [task("a", { status: "done" }), task("b"), task("c")],
      relations: [
        { sourceTaskId: "a", targetTaskId: "b", relationType: "blocks" },
        { sourceTaskId: "b", targetTaskId: "c", relationType: "related" },
      ],
    });

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({
      sourceTaskId: "a",
      targetTaskId: "b",
      state: "lit",
    });
  });

  it("marks the longest dependency chain as the critical path", () => {
    const graph = build({
      tasks: [task("a"), task("b"), task("c"), task("loose")],
      relations: [
        { sourceTaskId: "a", targetTaskId: "b", relationType: "blocks" },
        { sourceTaskId: "b", targetTaskId: "c", relationType: "subtask" },
      ],
    });

    const critical = new Set(
      graph.nodes
        .filter((node) => node.onCriticalPath)
        .map((node) => node.taskId),
    );
    expect(critical).toEqual(new Set(["a", "b", "c"]));
    expect(graph.edges.every((edge) => edge.onCriticalPath)).toBe(true);
  });

  it("survives a dependency cycle without hanging", () => {
    const graph = build({
      tasks: [task("a"), task("b")],
      relations: [
        { sourceTaskId: "a", targetTaskId: "b", relationType: "blocks" },
        { sourceTaskId: "b", targetTaskId: "a", relationType: "blocks" },
      ],
    });

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(2);
  });

  it("routes a backward dependency below the cards", () => {
    const graph = build({
      tasks: [
        task("later", { milestoneId: "m2" }),
        task("earlier", { milestoneId: "m1" }),
      ],
      milestones: [milestoneA, milestoneB],
      relations: [
        {
          sourceTaskId: "later",
          targetTaskId: "earlier",
          relationType: "blocks",
        },
      ],
    });

    const edge = graph.edges[0];
    expect(edge).toBeDefined();
    const numbers = edge?.path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    // Y values sit at odd indexes in "M x y C x1 y1, x2 y2, x3 y3".
    const ys = [numbers[1], numbers[3], numbers[5], numbers[7]];
    const lowestBottom = Math.max(
      ...graph.nodes.map((node) => node.y + node.height),
    );
    expect(Math.max(...ys)).toBeGreaterThan(lowestBottom + 20);
  });

  it("reports zone progress and graph bounds", () => {
    const graph = build({
      tasks: [
        task("done", { milestoneId: "m1", status: "done" }),
        task("open", { milestoneId: "m1" }),
      ],
      milestones: [milestoneA],
    });

    expect(graph.zones[0]).toMatchObject({
      milestoneId: "m1",
      taskCount: 2,
      completedCount: 1,
    });
    expect(graph.width).toBeGreaterThan(0);
    expect(graph.height).toBeGreaterThan(0);
  });
});
