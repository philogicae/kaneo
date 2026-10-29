// Mirrors apps/api/src/task/recurrence.ts — the API owns the spawn-on-complete
// rule, this copy exists so the calendar can project future occurrences with
// exactly the same clamping (Jan 31 + 1 month → Feb 28/29, not March 2/3).
export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval: number;
  /** Weekly rules only: 0 for Sunday to 6 for Saturday. */
  weekdays?: number[];
};

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function nextWeekday(date: Date, interval: number, weekdays: number[]) {
  const fromMonday = (day: number) => (day + 6) % 7;
  const days = [...new Set(weekdays)]
    .map(fromMonday)
    .sort((left, right) => left - right);
  const today = fromMonday(date.getDay());
  const later = days.find((day) => day > today);
  if (later !== undefined) return addDays(date, later - today);
  return addDays(date, 7 * interval + (days[0] ?? today) - today);
}

function addMonths(date: Date, months: number) {
  const next = new Date(date.getTime());
  const dayOfMonth = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() < dayOfMonth) next.setDate(0);
  return next;
}

function addYears(date: Date, years: number) {
  const next = new Date(date.getTime());
  const month = next.getMonth();
  next.setFullYear(next.getFullYear() + years);
  if (next.getMonth() !== month) next.setDate(0);
  return next;
}

export function shiftRecurrenceDate(date: Date, rule: RecurrenceRule): Date {
  switch (rule.frequency) {
    case "daily":
      return addDays(date, rule.interval);
    case "weekly":
      return rule.weekdays?.length
        ? nextWeekday(date, rule.interval, rule.weekdays)
        : addDays(date, 7 * rule.interval);
    case "monthly":
      return addMonths(date, rule.interval);
    case "yearly":
      return addYears(date, rule.interval);
  }
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

    let cursor = task.scheduleStart;
    for (let index = 1; index <= MAX_OCCURRENCE_PROJECTIONS; index += 1) {
      cursor = shiftRecurrenceDate(cursor, rule);
      if (cursor.getTime() > rangeEnd.getTime()) break;

      const occurrence: ProjectedOccurrence<TTask> = {
        ...task,
        id: `${task.id}#${index}`,
        sourceTaskId: task.id,
        scheduleStart: cursor,
        scheduleEnd: new Date(cursor.getTime() + spanMs),
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
