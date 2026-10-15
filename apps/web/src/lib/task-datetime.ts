type AnyDateInput = Date | string | number;

function toDate(input: AnyDateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

/**
 * True when the stored task date carries a meaningful time of day. Dates are
 * stored as timestamps, so a date-only pick lands at local midnight; anything
 * else was deliberately set by the user and should be shown and preserved.
 */
export function hasTimeComponent(value: AnyDateInput): boolean {
  const date = toDate(value);
  return date.getHours() !== 0 || date.getMinutes() !== 0;
}

/**
 * Replace the calendar day of `base` (keeping its time of day) with the day of
 * `next`. When `base` is date-only the result stays date-only (local
 * midnight), matching the existing behavior of a plain day pick.
 */
export function applyDatePreservingTime(
  base: AnyDateInput | undefined,
  next: Date,
): Date {
  if (!base) {
    return next;
  }
  const previous = toDate(base);
  previous.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
  return previous;
}

/**
 * Combine the selected day with an "HH:mm" local time. Returns null when the
 * input is not a complete, valid time.
 */
export function combineDateAndTime(
  base: AnyDateInput | undefined,
  time: string,
): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  const date = base ? toDate(base) : new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

/** Local "HH:mm" of a stored date, for <input type="time"> values. */
export function toTimeInputValue(value: AnyDateInput): string {
  const date = toDate(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

/**
 * Local midnight — defaults to today when no date is given. Fresh date setup
 * must land on 00:00: calendar day picks carry the wall-clock time of the
 * click, which used to leak into the stored date (the "15:00" reports).
 */
export function startOfDay(value?: AnyDateInput): Date {
  const date = value ? toDate(value) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}
