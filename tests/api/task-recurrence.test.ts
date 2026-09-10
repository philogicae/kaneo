import { describe, expect, it } from "vitest";
import { shiftRecurrenceDate } from "../../apps/api/src/task/recurrence";

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

  it("shifts monthly recurrences without overflow unchanged", () => {
    expect(
      shiftRecurrenceDate(date("2026-01-15T00:00:00Z"), {
        frequency: "monthly",
        interval: 1,
      })?.toISOString(),
    ).toBe("2026-02-15T00:00:00.000Z");
  });
});
