import { describe, expect, it } from "vitest";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { buildLabelGroups } from "./group-tasks";

function task(
  id: string,
  labels: Array<{ id: string; name: string; color: string }>,
) {
  return {
    id,
    title: `Task ${id}`,
    number: 1,
    description: null,
    status: "to-do",
    priority: "medium",
    startDate: null,
    dueDate: null,
    position: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "project-1",
    labels,
  } as unknown as Task;
}

function columns(tasks: Task[][]): ProjectWithTasks["columns"] {
  return tasks.map((columnTasks, index) => ({
    id: `col-${index}`,
    name: `Column ${index}`,
    isFinal: index === tasks.length - 1,
    icon: null,
    tasks: columnTasks,
  })) as unknown as ProjectWithTasks["columns"];
}

describe("buildLabelGroups", () => {
  it("creates one alphabetically sorted group per label", () => {
    const groups = buildLabelGroups(
      columns([
        [task("t1", [{ id: "l2", name: "frontend", color: "teal" }])],
        [
          task("t2", [
            { id: "l1", name: "branch:main", color: "dark-gray" },
            { id: "l2", name: "frontend", color: "teal" },
          ]),
        ],
      ]),
    );

    expect(groups.map((group) => group.name)).toEqual([
      "branch:main",
      "frontend",
    ]);
    expect(groups[0]?.id).toBe("label:l1");
    expect(groups[0]?.tasks.map((t) => t.id)).toEqual(["t2"]);
    // A task holding several labels appears in each of its groups.
    expect(groups[1]?.tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("appends a catch-all group for tasks without labels", () => {
    const groups = buildLabelGroups(
      columns([
        [
          task("t1", []),
          task("t2", [{ id: "l1", name: "bug", color: "purple" }]),
        ],
      ]),
    );

    expect(groups.map((group) => group.name)).toEqual(["bug", ""]);
    expect(groups[1]?.id).toBe("label:none");
    expect(groups[1]?.tasks.map((t) => t.id)).toEqual(["t1"]);
  });

  it("returns no catch-all group when every task carries a label", () => {
    const groups = buildLabelGroups(
      columns([[task("t1", [{ id: "l1", name: "chore", color: "purple" }])]]),
    );
    expect(groups.map((group) => group.id)).toEqual(["label:l1"]);
  });

  it("merges task-level label copies of the same label into one group", () => {
    const groups = buildLabelGroups(
      columns([
        [task("t1", [{ id: "copy-1", name: "frontend", color: "teal" }])],
        [task("t2", [{ id: "copy-2", name: "frontend", color: "teal" }])],
      ]),
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("merges same-name copies even when a legacy copy drifted to another color", () => {
    const groups = buildLabelGroups(
      columns([
        [task("t1", [{ id: "copy-1", name: "API", color: "teal" }])],
        [task("t2", [{ id: "copy-2", name: "API", color: "#0D9488" }])],
      ]),
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe("API");
    expect(groups[0]?.color).toBe("teal");
    expect(groups[0]?.tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("returns no groups for an empty board", () => {
    expect(buildLabelGroups(columns([[]]))).toEqual([]);
  });
});
