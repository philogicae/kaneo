import { describe, expect, it } from "vitest";
import type Appointment from "@/types/appointment";
import {
  appointmentsForDay,
  buildWeekDays,
  isSameDay,
  startOfWeek,
} from "./week-model";

/** Local-time dates keep the assertions independent of the runner timezone. */
function at(hours: number, minutes = 0) {
  return new Date(2026, 8, 16, hours, minutes);
}

function appointment(
  id: string,
  startDate: Date | null,
  dueDate: Date | null,
): Appointment {
  return {
    id,
    projectId: "project-1",
    position: null,
    number: null,
    userId: null,
    assigneeId: null,
    assigneeName: null,
    title: id,
    description: null,
    priority: "medium",
    startDate: startDate?.toISOString() ?? null,
    dueDate: dueDate?.toISOString() ?? null,
    reminderOffsets: null,
    recurrence: null,
    createdAt: new Date().toISOString(),
  };
}

describe("startOfWeek", () => {
  it("honours the preferred week start", () => {
    // Wednesday 2026-09-16.
    const wednesday = new Date(2026, 8, 16);

    expect(startOfWeek(wednesday, 1).getDay()).toBe(1);
    expect(startOfWeek(wednesday, 0).getDay()).toBe(0);
    expect(startOfWeek(wednesday, 6).getDay()).toBe(6);
    // Monday start lands on 2026-09-14.
    expect(startOfWeek(wednesday, 1).getDate()).toBe(14);
  });

  it("builds seven consecutive days from the week start", () => {
    const days = buildWeekDays(startOfWeek(new Date(2026, 8, 16), 1));

    expect(days).toHaveLength(7);
    expect(days[0].getDate()).toBe(14);
    expect(days[6].getDate()).toBe(20);
    expect(isSameDay(days[3], new Date(2026, 8, 17))).toBe(true);
  });
});

describe("appointmentsForDay", () => {
  const day = new Date(2026, 8, 16);

  it("positions an appointment in pixels from its start time", () => {
    const items = appointmentsForDay(
      [appointment("standup", at(9), at(10, 30))],
      day,
    );

    expect(items).toHaveLength(1);
    expect(items[0].startMinutes).toBe(9 * 60);
    expect(items[0].endMinutes).toBe(10 * 60 + 30);
    expect(items[0].top).toBe(9 * 44);
    expect(items[0].height).toBe(Math.round(1.5 * 44));
  });

  it("keeps a single-date appointment clickable with a 30-minute slot", () => {
    const items = appointmentsForDay(
      [appointment("checkpoint", at(14), at(14))],
      day,
    );

    expect(items).toHaveLength(1);
    expect(items[0].endMinutes - items[0].startMinutes).toBe(30);
  });

  it("clamps multi-day appointments to the visible day", () => {
    const previousDay = new Date(2026, 8, 15);
    const items = appointmentsForDay(
      [appointment("offsite", previousDay, new Date(2026, 8, 17, 12))],
      day,
    );

    expect(items).toHaveLength(1);
    expect(items[0].startMinutes).toBe(0);
    expect(items[0].endMinutes).toBe(24 * 60);
  });

  it("ignores appointments outside the day and unscheduled ones", () => {
    const items = appointmentsForDay(
      [
        appointment("tomorrow", new Date(2026, 8, 17, 9), null),
        appointment("undated", null, null),
      ],
      day,
    );

    expect(items).toHaveLength(0);
  });

  it("sorts by start time", () => {
    const items = appointmentsForDay(
      [appointment("late", at(16), at(17)), appointment("early", at(8), at(9))],
      day,
    );

    expect(items.map((item) => item.appointment.id)).toEqual(["early", "late"]);
  });
});
