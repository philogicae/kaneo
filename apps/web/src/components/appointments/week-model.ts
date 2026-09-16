import type { WeekStartDay } from "@/store/user-preferences";
import type Appointment from "@/types/appointment";

// Height of one hour row in the week grid; appointments position themselves
// in pixels from this.
export const HOUR_HEIGHT = 44;
export const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export type DayAppointment = {
  appointment: Appointment;
  top: number;
  height: number;
  startMinutes: number;
  endMinutes: number;
};

export function startOfDay(day: Date) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function parseAppointmentDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function startOfWeek(day: Date, weekStartsOn: WeekStartDay) {
  const start = startOfDay(day);
  const diff = (start.getDay() - weekStartsOn + 7) % 7;
  start.setDate(start.getDate() - diff);
  return start;
}

export function addDays(day: Date, days: number) {
  const next = new Date(day);
  next.setDate(next.getDate() + days);
  return next;
}

export function buildWeekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function minutesSince(dayStart: Date, moment: Date) {
  return Math.round((moment.getTime() - dayStart.getTime()) / 60_000);
}

/**
 * Appointments overlapping one day, clamped to that day and positioned in
 * pixels. A single-date appointment (no end, or the same instant) keeps a
 * 30-minute slot so it stays clickable.
 */
export function appointmentsForDay(
  appointments: Appointment[] | undefined,
  day: Date,
): DayAppointment[] {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);

  return (appointments ?? [])
    .flatMap((appointment) => {
      const start =
        parseAppointmentDate(appointment.startDate) ??
        parseAppointmentDate(appointment.dueDate);
      const end =
        parseAppointmentDate(appointment.dueDate) ??
        parseAppointmentDate(appointment.startDate);
      if (!start || !end) return [];

      const rangeStart = start <= end ? start : end;
      const rangeEnd = end >= start ? end : start;
      if (rangeEnd < dayStart || rangeStart >= dayEnd) return [];

      const clampedStart = rangeStart < dayStart ? dayStart : rangeStart;
      const clampedEnd = rangeEnd > dayEnd ? dayEnd : rangeEnd;
      const startMinutes = minutesSince(dayStart, clampedStart);
      let endMinutes = minutesSince(dayStart, clampedEnd);
      if (endMinutes <= startMinutes) {
        endMinutes = Math.min(24 * 60, startMinutes + 30);
      }

      return [
        {
          appointment,
          startMinutes,
          endMinutes,
          top: (startMinutes / 60) * HOUR_HEIGHT,
          height: Math.max(
            22,
            ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT,
          ),
        },
      ];
    })
    .sort((left, right) => left.startMinutes - right.startMinutes);
}
