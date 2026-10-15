import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

export type BoardGroupBy = "none" | "labels";

// Grouping is display-only: a task holding several labels appears once per
// label group, and drag & drop is disabled while a grouping is active (the
// groups are not the status columns, so a drop has no unambiguous meaning).
export type LabelGroup = {
  // Stable per group: `label:<first-label-id>` for labeled groups, and a
  // fixed id for the catch-all group.
  id: string;
  name: string;
  color: string | null;
  tasks: Task[];
};

const UNLABELED_GROUP_ID = "label:none";

export function buildLabelGroups(
  columns: ProjectWithTasks["columns"],
): LabelGroup[] {
  // A label name identifies one label per workspace, so groups are keyed by
  // name alone: task-level copies of the same workspace label (which carry
  // their own row ids) always land in a single group, even when a legacy copy
  // drifted to a different color. The first copy's color wins; the
  // label-color migration keeps copies mirroring the workspace definition.
  const groups = new Map<string, LabelGroup>();
  const unlabeled: LabelGroup = {
    id: UNLABELED_GROUP_ID,
    name: "",
    color: null,
    tasks: [],
  };

  for (const column of columns) {
    for (const task of column.tasks) {
      let placed = false;
      for (const label of task.labels ?? []) {
        let group = groups.get(label.name);
        if (!group) {
          group = {
            id: `label:${label.id}`,
            name: label.name,
            color: label.color,
            tasks: [],
          };
          groups.set(label.name, group);
        }
        group.tasks.push(task);
        placed = true;
      }
      if (!placed) {
        unlabeled.tasks.push(task);
      }
    }
  }

  const labeledGroups = [...groups.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  return unlabeled.tasks.length > 0
    ? [...labeledGroups, unlabeled]
    : labeledGroups;
}

export function isBoardGroupBy(value: unknown): value is BoardGroupBy {
  return value === "none" || value === "labels";
}
