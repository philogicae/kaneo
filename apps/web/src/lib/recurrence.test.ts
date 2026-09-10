import { describe, expect, it } from "vitest";
import { expandRecurringTasks, shiftRecurrenceDate } from "./recurrence";

describe("shiftRecurrenceDate", () => {
  it("shifts daily and weekly rules", () => {
    const base = new Date(2026, 0, 10, 9, 30);

    expect(
      shiftRecurrenceDate(base, { frequency: "daily", interval: 2 }),
    ).toEqual(new Date(2026, 0, 12, 9, 30));
    expect(
      shiftRecurrenceDate(base, { frequency: "weekly", interval: 1 }),
    ).toEqual(new Date(2026, 0, 17, 9, 30));
  });

  it("clamps monthly shifts to the end of the target month", () => {
    const january = new Date(2026, 0, 31, 12, 0);

    expect(
      shiftRecurrenceDate(january, { frequency: "monthly", interval: 1 }),
    ).toEqual(new Date(2026, 1, 28, 12, 0));
    // 2028 is a leap year.
    expect(
      shiftRecurrenceDate(new Date(2028, 0, 31), {
        frequency: "monthly",
        interval: 1,
      }),
    ).toEqual(new Date(2028, 1, 29));
    expect(
      shiftRecurrenceDate(new Date(2026, 0, 15), {
        frequency: "monthly",
        interval: 2,
      }),
    ).toEqual(new Date(2026, 2, 15));
  });

  it("does not mutate the input date", () => {
    const base = new Date(2026, 0, 10);
    shiftRecurrenceDate(base, { frequency: "daily", interval: 5 });
    expect(base).toEqual(new Date(2026, 0, 10));
  });
});

describe("expandRecurringTasks", () => {
  const makeTask = (
    overrides: Partial<Parameters<typeof expandRecurringTasks>[0][number]> = {},
  ) => ({
    id: "t1",
    recurrence: { frequency: "weekly" as const, interval: 1 },
    scheduleStart: new Date(2026, 5, 1, 9, 0),
    scheduleEnd: new Date(2026, 5, 1, 9, 0),
    ...overrides,
  });

  it("projects occurrences inside the range and keeps the base task", () => {
    // Range covers the first three weeks of June 2026.
    const expanded = expandRecurringTasks(
      [makeTask()],
      new Date(2026, 5, 1),
      new Date(2026, 5, 21),
    );

    const ids = expanded.map((task) => task.id);
    expect(ids).toEqual(["t1", "t1#1", "t1#2"]);
    expect(expanded[1]).toMatchObject({
      sourceTaskId: "t1",
      scheduleStart: new Date(2026, 5, 8, 9, 0),
    });
  });

  it("skips occurrences outside the range", () => {
    const expanded = expandRecurringTasks(
      [
        makeTask({
          scheduleStart: new Date(2026, 5, 20),
          scheduleEnd: new Date(2026, 5, 20),
        }),
      ],
      new Date(2026, 5, 1),
      new Date(2026, 5, 21),
    );

    // The next weekly occurrence (Jun 27) is past the range end.
    expect(expanded.map((task) => task.id)).toEqual(["t1"]);
  });

  it("honours canProject so completed tasks do not duplicate spawned tasks", () => {
    const expanded = expandRecurringTasks(
      [makeTask()],
      new Date(2026, 5, 1),
      new Date(2026, 5, 21),
      () => false,
    );

    expect(expanded.map((task) => task.id)).toEqual(["t1"]);
  });

  it("ignores tasks without a recurrence rule", () => {
    const expanded = expandRecurringTasks(
      [makeTask({ recurrence: null })],
      new Date(2026, 5, 1),
      new Date(2026, 5, 21),
    );

    expect(expanded.map((task) => task.id)).toEqual(["t1"]);
  });

  it("preserves multi-day spans across occurrences", () => {
    const expanded = expandRecurringTasks(
      [
        makeTask({
          recurrence: { frequency: "daily", interval: 7 },
          scheduleStart: new Date(2026, 5, 1),
          scheduleEnd: new Date(2026, 5, 3),
        }),
      ],
      new Date(2026, 5, 1),
      new Date(2026, 5, 30),
    );

    const second = expanded.find((task) => task.id === "t1#2");
    expect(second?.scheduleStart).toEqual(new Date(2026, 5, 15));
    expect(second?.scheduleEnd).toEqual(new Date(2026, 5, 17));
  });

  it("sorts the merged list by schedule start", () => {
    const expanded = expandRecurringTasks(
      [
        makeTask({
          id: "t2",
          recurrence: null,
          scheduleStart: new Date(2026, 5, 10),
          scheduleEnd: new Date(2026, 5, 10),
        }),
        makeTask({
          id: "t1",
          scheduleStart: new Date(2026, 5, 1),
          scheduleEnd: new Date(2026, 5, 1),
        }),
      ],
      new Date(2026, 5, 1),
      new Date(2026, 5, 21),
    );

    expect(expanded.map((task) => task.id)).toEqual([
      "t1",
      "t1#1",
      "t2",
      "t1#2",
    ]);
  });
});
