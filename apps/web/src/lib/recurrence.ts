// Mirrors apps/api/src/task/recurrence.ts — the API owns the spawn-on-complete
// rule, this copy exists so the calendar can project future occurrences with
// exactly the same clamping (Jan 31 + 1 month → Feb 28/29, not March 2/3).
export type RecurrenceFrequency = "daily" | "weekly" | "monthly";

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval: number;
};

export function shiftRecurrenceDate(date: Date, rule: RecurrenceRule): Date {
  const next = new Date(date.getTime());

  switch (rule.frequency) {
    case "daily":
      next.setDate(next.getDate() + rule.interval);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7 * rule.interval);
      break;
    case "monthly": {
      const dayOfMonth = next.getDate();
      next.setMonth(next.getMonth() + rule.interval);
      if (next.getDate() < dayOfMonth) {
        // Overflowed into the month after the target one.
        next.setDate(0);
      }
      break;
    }
  }

  return next;
}

export type ProjectableTask = {
  id: string;
  recurrence?: RecurrenceRule | null;
  scheduleStart: Date;
  scheduleEnd: Date;
};

export type ProjectedOccurrence<TTask> = TTask & {
  sourceTaskId: string;
};

// Future occurrences are not rows in the database (they are spawned only on
// completion), so date-based views project them client-side. Completed
// recurring tasks must not project: completing one already spawns its next
// occurrence as a real task, and both projecting would show the same slot
// twice.
export const MAX_OCCURRENCE_PROJECTIONS = 60;

export function expandRecurringTasks<TTask extends ProjectableTask>(
  tasks: TTask[],
  rangeStart: Date,
  rangeEnd: Date,
  canProject: (task: TTask) => boolean = () => true,
): Array<TTask | ProjectedOccurrence<TTask>> {
  const expanded: Array<TTask | ProjectedOccurrence<TTask>> = [];

  for (const task of tasks) {
    expanded.push(task);
    const rule = task.recurrence;
    if (!rule || !canProject(task)) continue;

    const spanMs = Math.max(
      task.scheduleEnd.getTime() - task.scheduleStart.getTime(),
      0,
    );

    for (let index = 1; index <= MAX_OCCURRENCE_PROJECTIONS; index += 1) {
      const start = shiftRecurrenceDate(task.scheduleStart, {
        frequency: rule.frequency,
        interval: rule.interval * index,
      });
      if (start.getTime() > rangeEnd.getTime()) break;

      const occurrence: ProjectedOccurrence<TTask> = {
        ...task,
        id: `${task.id}#${index}`,
        sourceTaskId: task.id,
        scheduleStart: start,
        scheduleEnd: new Date(start.getTime() + spanMs),
      };

      if (occurrence.scheduleEnd.getTime() >= rangeStart.getTime()) {
        expanded.push(occurrence);
      }
    }
  }

  return expanded.sort(
    (left, right) =>
      left.scheduleStart.getTime() - right.scheduleStart.getTime(),
  );
}
