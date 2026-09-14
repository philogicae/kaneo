import { describe, expect, it } from "vitest";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { applyTaskDrop, getNextManualPosition } from "./apply-task-drop";

function makeTask(id: string, status: string, position: number | null): Task {
  return {
    id,
    title: `Task ${id}`,
    number: 1,
    description: null,
    status,
    priority: null,
    startDate: null,
    dueDate: null,
    position,
    createdAt: "2026-01-01T00:00:00.000Z",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "project-1",
  };
}

function makeColumn(id: string, tasks: Task[]) {
  return { id, slug: id, name: id, icon: null, isFinal: false, tasks };
}

function makeProject(columns: ProjectWithTasks["columns"]): ProjectWithTasks {
  return {
    id: "project-1",
    name: "Project",
    slug: "PRJ",
    icon: "Layout",
    description: null,
    isPublic: false,
    workspaceId: "workspace-1",
    columns,
    plannedTasks: [],
    archivedTasks: [],
  } as unknown as ProjectWithTasks;
}

const columnTasks = (project: ProjectWithTasks, id: string) =>
  project.columns.find((column) => column.id === id)?.tasks ?? [];

describe("getNextManualPosition", () => {
  it("starts at zero for an empty column", () => {
    expect(getNextManualPosition([])).toBe(0);
  });

  it("appends after the current maximum", () => {
    expect(getNextManualPosition([makeTask("a", "to-do", 3)])).toBe(4);
  });
});

describe("applyTaskDrop without an active sort", () => {
  it("moves a task across columns and renumbers both columns", () => {
    const project = makeProject([
      makeColumn("to-do", [
        makeTask("a", "to-do", 0),
        makeTask("b", "to-do", 1),
      ]),
      makeColumn("done", [makeTask("c", "done", 0)]),
    ]);

    const result = applyTaskDrop({
      project,
      activeTaskId: "a",
      overId: "c",
      sortActive: false,
    });

    expect(columnTasks(result.project, "done").map((t) => t.id)).toEqual([
      "c",
      "a",
    ]);
    expect(
      columnTasks(result.project, "done").find((t) => t.id === "a")?.status,
    ).toBe("done");
    expect(columnTasks(result.project, "to-do").map((t) => t.id)).toEqual([
      "b",
    ]);
    expect(result.updates).toEqual([
      expect.objectContaining({ id: "c", status: "done", position: 0 }),
      expect.objectContaining({ id: "a", status: "done", position: 1 }),
      expect.objectContaining({ id: "b", position: 0 }),
    ]);
  });

  it("reorders tasks within the same column", () => {
    const project = makeProject([
      makeColumn("to-do", [
        makeTask("a", "to-do", 0),
        makeTask("b", "to-do", 1),
        makeTask("c", "to-do", 2),
      ]),
    ]);

    const result = applyTaskDrop({
      project,
      activeTaskId: "a",
      overId: "b",
      sortActive: false,
    });

    expect(columnTasks(result.project, "to-do").map((t) => t.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(
      result.updates.map((t) => ({ id: t.id, position: t.position })),
    ).toEqual([
      { id: "b", position: 0 },
      { id: "a", position: 1 },
      { id: "c", position: 2 },
    ]);
  });
});

describe("applyTaskDrop with an active sort", () => {
  it("only changes the status and appends to the destination manual order", () => {
    const project = makeProject([
      makeColumn("to-do", [
        makeTask("a", "to-do", 0),
        makeTask("b", "to-do", 1),
      ]),
      makeColumn("done", [makeTask("c", "done", 0)]),
    ]);

    const result = applyTaskDrop({
      project,
      activeTaskId: "a",
      overId: "c",
      sortActive: true,
    });

    expect(columnTasks(result.project, "done").map((t) => t.id)).toEqual([
      "c",
      "a",
    ]);
    expect(columnTasks(result.project, "to-do").map((t) => t.id)).toEqual([
      "b",
    ]);
    expect(result.updates).toEqual([
      expect.objectContaining({ id: "a", status: "done", position: 1 }),
    ]);
    // Other tasks keep their manual positions.
    expect(
      columnTasks(result.project, "done").find((t) => t.id === "c")?.position,
    ).toBe(0);
    expect(
      columnTasks(result.project, "to-do").find((t) => t.id === "b")?.position,
    ).toBe(1);
  });

  it("appends with position zero when dropping on an empty column", () => {
    const project = makeProject([
      makeColumn("to-do", [makeTask("a", "to-do", 5)]),
      makeColumn("done", []),
    ]);

    const result = applyTaskDrop({
      project,
      activeTaskId: "a",
      overId: "done",
      sortActive: true,
    });

    expect(result.updates).toEqual([
      expect.objectContaining({ id: "a", status: "done", position: 0 }),
    ]);
    expect(columnTasks(result.project, "done").map((t) => t.id)).toEqual(["a"]);
  });

  it("ignores a same-column drop so the sort order is preserved", () => {
    const project = makeProject([
      makeColumn("to-do", [
        makeTask("a", "to-do", 0),
        makeTask("b", "to-do", 1),
      ]),
    ]);

    const result = applyTaskDrop({
      project,
      activeTaskId: "a",
      overId: "b",
      sortActive: true,
    });

    expect(result.updates).toEqual([]);
    expect(result.project).toBe(project);
    expect(columnTasks(result.project, "to-do").map((t) => t.id)).toEqual([
      "a",
      "b",
    ]);
  });
});
