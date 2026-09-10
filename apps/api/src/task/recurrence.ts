export type RecurrenceFrequency = "daily" | "weekly" | "monthly";

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval: number;
};

/**
 * Shift a task date by one recurrence period. Monthly shifts clamp to the
 * last day of the target month (Jan 31 + 1 month lands on Feb 28/29) instead
 * of overflowing into March like raw Date arithmetic would.
 */
export function shiftRecurrenceDate(
  date: Date | null,
  rule: RecurrenceRule,
): Date | null {
  if (!date) return null;

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
