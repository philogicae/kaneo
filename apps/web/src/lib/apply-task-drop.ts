import { produce } from "immer";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

type ApplyTaskDropArgs = {
  project: ProjectWithTasks;
  activeTaskId: string;
  overId: string;
  /**
   * True when the visible order comes from a sort rather than manual
   * positions. In that mode a drop must not rewrite the manual order: the
   * sort re-applies as soon as the project re-renders.
   */
  sortActive: boolean;
};

type ApplyTaskDropResult = {
  project: ProjectWithTasks;
  /** Tasks to persist, in the order their mutations should fire. */
  updates: Task[];
};

/**
 * Positions are compared within a column, so appending after the current
 * maximum keeps the moved task last in manual order without colliding.
 */
export function getNextManualPosition(tasks: Task[]): number {
  return Math.max(-1, ...tasks.map((task) => task.position ?? -1)) + 1;
}

/**
 * Applies a drag-and-drop result to a column-based project (kanban board and
 * list view). With a sort active, a cross-column drop only changes the status
 * and appends the task to the destination's manual order; a same-column drop
 * is a no-op because the sort defines the order. Without a sort, the existing
 * manual reordering and renumbering behavior applies.
 */
export function applyTaskDrop({
  project,
  activeTaskId,
  overId,
  sortActive,
}: ApplyTaskDropArgs): ApplyTaskDropResult {
  const updates: Task[] = [];

  const nextProject = produce(project, (draft) => {
    const sourceColumn = draft.columns?.find((col) =>
      col.tasks.some((task) => task.id === activeTaskId),
    );
    const destinationColumn = draft.columns?.find(
      (col) =>
        col.id === overId || col.tasks.some((task) => task.id === overId),
    );

    if (!sourceColumn || !destinationColumn) return;

    const sourceTaskIndex = sourceColumn.tasks.findIndex(
      (task) => task.id === activeTaskId,
    );
    const task = sourceColumn.tasks[sourceTaskIndex];
    if (!task) return;

    if (sourceColumn.id === destinationColumn.id) {
      if (sortActive) return;

      sourceColumn.tasks = sourceColumn.tasks.filter(
        (t) => t.id !== activeTaskId,
      );

      let destinationIndex = destinationColumn.tasks.findIndex(
        (t) => t.id === overId,
      );
      if (sourceTaskIndex <= destinationIndex) {
        destinationIndex += 1;
      }
      destinationColumn.tasks.splice(destinationIndex, 0, task);

      destinationColumn.tasks.forEach((t, index) => {
        t.position = index;
        updates.push({ ...t });
      });
      return;
    }

    sourceColumn.tasks = sourceColumn.tasks.filter(
      (t) => t.id !== activeTaskId,
    );

    // A task's status is a column slug. The column id is only the droppable
    // identity here, and the two are interchangeable only because the tasks
    // endpoint happens to return `id: column.slug`.
    task.status = destinationColumn.slug;

    if (sortActive) {
      task.position = getNextManualPosition(destinationColumn.tasks);
      destinationColumn.tasks = [...destinationColumn.tasks, task];
      updates.push({ ...task });
      return;
    }

    const destinationIndex =
      overId === destinationColumn.id
        ? destinationColumn.tasks.length
        : destinationColumn.tasks.findIndex((t) => t.id === overId) + 1;

    destinationColumn.tasks.splice(destinationIndex, 0, task);

    destinationColumn.tasks.forEach((t, index) => {
      t.position = index;
      updates.push({ ...t, status: destinationColumn.slug });
    });

    sourceColumn.tasks.forEach((t, index) => {
      t.position = index;
      updates.push({ ...t });
    });
  });

  return { project: nextProject, updates };
}
