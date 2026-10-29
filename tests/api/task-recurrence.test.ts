import { describe, expect, it } from "vite-plus/test";
import {
  shiftRecurrenceDate,
  shiftRecurrenceDates,
} from "../../apps/api/src/task/recurrence";

const date = (iso: string) => new Date(iso);

describe("shiftRecurrenceDate", () => {
  it("returns null for tasks without a date", () => {
    expect(
      shiftRecurrenceDate(null, { frequency: "daily", interval: 1 }),
    ).toBeNull();
  });

  it("shifts daily recurrences", () => {
    expect(
      shiftRecurrenceDate(date("2026-01-10T09:30:00Z"), {
        frequency: "daily",
        interval: 1,
      })?.toISOString(),
    ).toBe("2026-01-11T09:30:00.000Z");
  });

  it("shifts weekly recurrences by whole weeks", () => {
    expect(
      shiftRecurrenceDate(date("2026-01-05T08:00:00Z"), {
        frequency: "weekly",
        interval: 2,
      })?.toISOString(),
    ).toBe("2026-01-19T08:00:00.000Z");
  });

  it("keeps the time of day across shifts", () => {
    const original = date("2026-03-01T14:45:00Z");
    const shifted = shiftRecurrenceDate(original, {
      frequency: "monthly",
      interval: 1,
    });
    // Times are preserved as wall-clock local time (what the user entered).
    expect(shifted?.getHours()).toBe(original.getHours());
    expect(shifted?.getMinutes()).toBe(original.getMinutes());
  });

  it("clamps monthly shifts that overflow the target month", () => {
    // Jan 31 + 1 month must land on Feb 28 (2026 is not a leap year), not
    // Mar 3 like raw Date arithmetic would produce.
    expect(
      shiftRecurrenceDate(date("2026-01-31T00:00:00Z"), {
        frequency: "monthly",
        interval: 1,
      })?.toISOString(),
    ).toBe("2026-02-28T00:00:00.000Z");
  });

  it("shifts yearly recurrences and clamps February 29", () => {
    expect(
      shiftRecurrenceDate(new Date(2026, 4, 12, 8, 0), {
        frequency: "yearly",
        interval: 2,
      }),
    ).toEqual(new Date(2028, 4, 12, 8, 0));
    expect(
      shiftRecurrenceDate(new Date(2028, 1, 29), {
        frequency: "yearly",
        interval: 1,
      }),
    ).toEqual(new Date(2029, 1, 28));
  });

  it("picks selected weekdays, wrapping after the current week", () => {
    expect(
      shiftRecurrenceDate(new Date(2026, 0, 5, 9, 0), {
        frequency: "weekly",
        interval: 1,
        weekdays: [3],
      }),
    ).toEqual(new Date(2026, 0, 7, 9, 0));
    expect(
      shiftRecurrenceDate(new Date(2026, 0, 9, 9, 0), {
        frequency: "weekly",
        interval: 2,
        weekdays: [1],
      }),
    ).toEqual(new Date(2026, 0, 19, 9, 0));
  });

  it("keeps the start/due span across a weekday shift", () => {
    const next = shiftRecurrenceDates(
      {
        startDate: new Date(2026, 0, 5, 9, 0),
        dueDate: new Date(2026, 0, 9, 17, 0),
      },
      { frequency: "weekly", interval: 1, weekdays: [3] },
    );
    expect(next.startDate).toEqual(new Date(2026, 0, 7, 9, 0));
    expect(next.dueDate).toEqual(new Date(2026, 0, 11, 17, 0));
  });

  it("shifts monthly recurrences without overflow unchanged", () => {
    expect(
      shiftRecurrenceDate(date("2026-01-15T00:00:00Z"), {
        frequency: "monthly",
        interval: 1,
      })?.toISOString(),
    ).toBe("2026-02-15T00:00:00.000Z");
  });
});
