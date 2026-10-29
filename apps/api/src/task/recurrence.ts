export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval: number;
  /**
   * Weekly rules only: days to repeat on, 0 for Sunday to 6 for Saturday.
   * Without them the rule repeats on the anchor date's weekday.
   */
  weekdays?: number[];
};

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

// Weeks start on Monday. The next selected day later in the same week wins;
// otherwise the first selected day `interval` weeks later.
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
  if (next.getDate() < dayOfMonth) {
    // Overflowed into the month after the target one.
    next.setDate(0);
  }
  return next;
}

function addYears(date: Date, years: number) {
  const next = new Date(date.getTime());
  const month = next.getMonth();
  next.setFullYear(next.getFullYear() + years);
  // February 29 lands on March 1 in a non-leap year; clamp to February 28.
  if (next.getMonth() !== month) next.setDate(0);
  return next;
}

/**
 * Shift a task date by one recurrence period. Monthly and yearly shifts clamp
 * to the last day of the target month instead of overflowing into the next
 * one like raw Date arithmetic would.
 */
export function shiftRecurrenceDate(
  date: Date | null,
  rule: RecurrenceRule,
): Date | null {
  if (!date) return null;

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

// Calendar days rather than milliseconds: DST must not turn a one-day span
// into 23 or 25 hours.
function calendarDaysBetween(from: Date, to: Date) {
  const utc = (date: Date) =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** Keep the start/due span when both dates are set. */
export function shiftRecurrenceDates(
  task: { startDate: Date | null; dueDate: Date | null },
  rule: RecurrenceRule,
) {
  if (!task.startDate || !task.dueDate) {
    return {
      startDate: shiftRecurrenceDate(task.startDate, rule),
      dueDate: shiftRecurrenceDate(task.dueDate, rule),
    };
  }

  // Recurrence is anchored to the start date in the UI, so move that first
  // and carry the same span onto the due date.
  const startDate = shiftRecurrenceDate(task.startDate, rule);
  if (!startDate) return { startDate: null, dueDate: null };
  const span = calendarDaysBetween(task.startDate, startDate);
  return {
    startDate,
    dueDate: addDays(task.dueDate, span),
  };
}
