import { describe, expect, it } from "vitest";
import type { ProjectChartsBucket } from "@/fetchers/project/get-project-charts";
import {
  aggregateBuckets,
  averageCompleted,
  cumulativeBuckets,
  plotMinWidth,
  tickIndexes,
} from "./chart-utils";

function bucket(bucketStart: string, created = 0, completed = 0) {
  return { bucketStart, created, completed };
}

function series(start: Date, stepMs: number, count: number) {
  return Array.from({ length: count }, (_, index) =>
    bucket(new Date(start.getTime() + index * stepMs).toISOString()),
  );
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("tickIndexes", () => {
  it("returns no ticks for an empty series", () => {
    expect(tickIndexes([], "week")).toEqual([]);
  });

  it("labels day changes on hourly buckets", () => {
    // A week of hourly buckets: Monday 00:00 to Sunday 23:00.
    const buckets = series(new Date("2026-09-14T00:00:00.000Z"), HOUR, 168);
    const ticks = tickIndexes(buckets, "hour");
    expect(ticks).toHaveLength(7);
    expect(ticks[0]?.index).toBe(0);
    expect(
      ticks
        .slice(1)
        .every(({ bucket: b }) => b.bucketStart.endsWith("T00:00:00.000Z")),
    ).toBe(true);
  });

  it("falls back to evenly spaced ticks when a short daily window has no month change", () => {
    const buckets = series(new Date("2026-09-14T00:00:00.000Z"), DAY, 7);
    const ticks = tickIndexes(buckets, "day");
    expect(ticks[0]?.index).toBe(0);
    expect(ticks.at(-1)?.index).toBe(6);
    expect(ticks.length).toBeLessThanOrEqual(7);
  });

  it("labels month changes on daily buckets", () => {
    const buckets = series(new Date("2026-06-01T00:00:00.000Z"), DAY, 31);
    const ticks = tickIndexes(buckets, "day");
    expect(ticks[0]?.index).toBe(0);
    expect(ticks).toHaveLength(2);
    expect(ticks.at(-1)?.bucket.bucketStart).toBe("2026-07-01T00:00:00.000Z");
  });

  it("thins monthly buckets that would collide", () => {
    const buckets = Array.from({ length: 13 }, (_, index) => {
      const date = new Date("2025-09-01T00:00:00.000Z");
      date.setUTCMonth(date.getUTCMonth() + index);
      return bucket(date.toISOString());
    });
    const ticks = tickIndexes(buckets, "month");
    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks.length).toBeLessThanOrEqual(7);
    expect(ticks[0]?.index).toBe(0);
    expect(ticks.at(-1)?.index).toBe(buckets.length - 1);
  });
});

describe("aggregateBuckets", () => {
  it("sums projects sharing a window and keeps buckets sorted", () => {
    const a = [
      bucket("2026-09-07T00:00:00.000Z", 1, 0),
      bucket("2026-09-14T00:00:00.000Z", 2, 1),
    ];
    const b = [
      bucket("2026-09-14T00:00:00.000Z", 3, 2),
      bucket("2026-09-21T00:00:00.000Z", 0, 1),
    ];
    expect(aggregateBuckets([a, b, undefined])).toEqual([
      bucket("2026-09-07T00:00:00.000Z", 1, 0),
      bucket("2026-09-14T00:00:00.000Z", 5, 3),
      bucket("2026-09-21T00:00:00.000Z", 0, 1),
    ]);
  });
});

describe("cumulativeBuckets", () => {
  it("accumulates created/completed and floors the backlog at zero", () => {
    const buckets = [
      bucket("2026-09-07T00:00:00.000Z", 2, 0),
      // A deleted task can leave more completions than creations in a window.
      bucket("2026-09-14T00:00:00.000Z", 0, 3),
    ] as ProjectChartsBucket[];
    expect(
      cumulativeBuckets(buckets).map(({ tasks, backlog }) => ({
        tasks,
        backlog,
      })),
    ).toEqual([
      { tasks: 2, backlog: 2 },
      { tasks: 2, backlog: 0 },
    ]);
  });
});

describe("averageCompleted", () => {
  it("returns zero for an empty series and the mean otherwise", () => {
    expect(averageCompleted([])).toBe(0);
    expect(
      averageCompleted([
        bucket("2026-09-07T00:00:00.000Z", 0, 2),
        bucket("2026-09-14T00:00:00.000Z", 0, 0),
      ]),
    ).toBe(1);
  });
});

describe("plotMinWidth", () => {
  it("keeps the fill-the-card layout while buckets stay readable", () => {
    // 53 weekly buckets in a 735px card: ~14px each, no scrolling needed.
    expect(plotMinWidth(53, 735)).toBeUndefined();
    // Exactly at the threshold the natural width still wins.
    expect(plotMinWidth(100, 300)).toBeUndefined();
  });

  it("falls back to a per-bucket floor when the series is dense", () => {
    // 12 months at day granularity: 385 buckets would get ~1.9px each.
    expect(plotMinWidth(385, 735)).toBe(385 * 6);
    // 1 week at hour granularity on a narrow phone card.
    expect(plotMinWidth(168, 340)).toBe(168 * 6);
  });

  it("does nothing before it can measure a plot", () => {
    expect(plotMinWidth(0, 735)).toBeUndefined();
    expect(plotMinWidth(385, 0)).toBeUndefined();
  });
});
