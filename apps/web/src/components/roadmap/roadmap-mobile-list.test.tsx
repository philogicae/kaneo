import enUS from "@i18n/en-US.json";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoadmapGraph } from "@/lib/roadmap-layout";
import RoadmapMobileList from "./roadmap-mobile-list";

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const [namespace, path] = key.split(":");
      const source = path
        .split(".")
        .reduce<unknown>(
          (current, segment) =>
            current && typeof current === "object"
              ? (current as Record<string, unknown>)[segment]
              : undefined,
          (enUS as Record<string, unknown>)[namespace ?? ""],
        );
      if (typeof source !== "string") {
        return key;
      }
      return source.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String(options?.[name] ?? ""),
      );
    },
  }),
}));

const graph: RoadmapGraph = {
  zones: [
    {
      milestoneId: null,
      name: "",
      color: "gray",
      x: 0,
      width: 288,
      taskCount: 2,
      completedCount: 1,
    },
    {
      milestoneId: "milestone-1",
      name: "Sprint 1",
      color: "sky",
      x: 304,
      width: 288,
      taskCount: 1,
      completedCount: 0,
    },
  ],
  nodes: [
    {
      id: "node-a",
      taskId: "task-a",
      title: "Ship the roadmap",
      status: "done",
      priority: null,
      milestoneId: null,
      assigneeName: "Arnaud",
      labelNames: ["frontend"],
      number: 120,
      state: "done",
      x: 20,
      y: 72,
      width: 248,
      height: 56,
      onCriticalPath: false,
    },
    {
      id: "node-b",
      taskId: "task-b",
      title: "Blocked follow-up",
      status: "to-do",
      priority: null,
      milestoneId: null,
      assigneeName: null,
      labelNames: [],
      number: 121,
      state: "blocked",
      x: 20,
      y: 140,
      width: 248,
      height: 56,
      onCriticalPath: false,
    },
    {
      id: "node-c",
      taskId: "task-c",
      title: "Next sprint work",
      status: "to-do",
      priority: null,
      milestoneId: "milestone-1",
      assigneeName: null,
      labelNames: [],
      number: 122,
      state: "todo",
      x: 324,
      y: 72,
      width: 248,
      height: 56,
      onCriticalPath: false,
    },
  ],
  edges: [],
  width: 612,
  height: 200,
};

describe("RoadmapMobileList", () => {
  afterEach(cleanup);

  it("lists every sprint with its tasks and state", () => {
    render(
      <RoadmapMobileList graph={graph} filter="all" onOpenTask={vi.fn()} />,
    );

    expect(screen.getByText("No sprint")).toBeDefined();
    expect(screen.getByText("Sprint 1")).toBeDefined();
    expect(screen.getByText("1/2 done")).toBeDefined();
    expect(screen.getByText("0/1 done")).toBeDefined();
    expect(screen.getByText("Ship the roadmap")).toBeDefined();
    expect(screen.getByText("Blocked follow-up")).toBeDefined();
    expect(screen.getByText("Next sprint work")).toBeDefined();
    expect(screen.getByText("Arnaud · frontend")).toBeDefined();
  });

  it("keeps only the tasks matching the active filter", () => {
    render(
      <RoadmapMobileList graph={graph} filter="blocked" onOpenTask={vi.fn()} />,
    );

    expect(screen.getByText("Blocked follow-up")).toBeDefined();
    expect(screen.queryByText("Ship the roadmap")).toBeNull();
    expect(screen.queryByText("Next sprint work")).toBeNull();
    // Sprint headers stay visible so the progress reading is untouched.
    expect(screen.getByText("Sprint 1")).toBeDefined();
  });

  it("opens the task sheet when a row is clicked", () => {
    const onOpenTask = vi.fn();
    render(
      <RoadmapMobileList graph={graph} filter="all" onOpenTask={onOpenTask} />,
    );

    screen.getByText("Blocked follow-up").closest("button")?.click();
    expect(onOpenTask).toHaveBeenCalledWith("task-b");
  });
});
