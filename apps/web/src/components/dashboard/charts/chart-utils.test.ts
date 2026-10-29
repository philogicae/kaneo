import { describe, expect, it } from "vite-plus/test";
import type { ProjectChartsBucket } from "@/fetchers/project/get-project-charts";
import {
  aggregateBuckets,
  averageCompleted,
  compressBuckets,
  cumulativeBuckets,
  formatBucketRange,
  plotMinWidth,
  summarizeTasks,
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
      bucket("2026-09-21T00:00:00.000Z", 0, 0),
    ] as ProjectChartsBucket[];
    expect(
      cumulativeBuckets(buckets).map(({ tasks, backlog, done }) => ({
        tasks,
        backlog,
        done,
      })),
    ).toEqual([
      { tasks: 2, backlog: 2, done: 0 },
      { tasks: 2, backlog: 0, done: 3 },
      // Done keeps its running total on a quiet bucket instead of resetting.
      { tasks: 2, backlog: 0, done: 3 },
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

describe("compressBuckets", () => {
  it("leaves a readable series untouched", () => {
    const buckets = [
      bucket("2026-09-07T00:00:00.000Z", 1, 0),
      bucket("2026-09-14T00:00:00.000Z", 2, 1),
    ];
    expect(compressBuckets(buckets, 72)).toEqual(buckets);
  });

  it("merges adjacent buckets so a dense series never scrolls", () => {
    const buckets = series(new Date("2026-01-01T00:00:00.000Z"), DAY, 365).map(
      (entry, index) => ({ ...entry, created: index, completed: index % 2 }),
    );
    const compressed = compressBuckets(buckets, 72);
    expect(compressed.length).toBeLessThanOrEqual(72);
    expect(compressed.reduce((sum, entry) => sum + entry.created, 0)).toBe(
      buckets.reduce((sum, entry) => sum + entry.created, 0),
    );
    expect(compressed[0]?.bucketStart).toBe(buckets[0]?.bucketStart);
    expect(compressed.at(-1)?.bucketEnd).toBe(buckets.at(-1)?.bucketStart);
  });

  it("formats a grouped bucket as a range", () => {
    expect(
      formatBucketRange(
        "2026-01-01T00:00:00.000Z",
        "2026-01-03T00:00:00.000Z",
        "day",
      ),
    ).toContain("–");
  });
});

describe("summarizeTasks", () => {
  const now = new Date("2026-09-15T12:00:00.000Z");

  it("separates open, done, backlog and due pressure", () => {
    const stats = summarizeTasks(
      {
        columns: [
          {
            isFinal: false,
            tasks: [
              { dueDate: "2026-09-10T12:00:00.000Z", assigneeId: "u1" },
              { dueDate: "2026-09-18T12:00:00.000Z", assigneeId: "u1" },
              { dueDate: null, assigneeId: null },
            ],
          },
          {
            isFinal: true,
            tasks: [{ dueDate: "2026-09-01T12:00:00.000Z", assigneeId: "u2" }],
          },
        ],
        plannedTasks: [{}, {}],
      },
      now,
    );

    expect(stats).toMatchObject({
      total: 4,
      open: 3,
      done: 1,
      backlog: 2,
      overdue: 1,
      dueSoon: 1,
      assignees: 2,
      completion: 25,
    });
  });

  it("handles a project with no tasks", () => {
    expect(summarizeTasks(undefined, now)).toEqual({
      total: 0,
      open: 0,
      done: 0,
      backlog: 0,
      overdue: 0,
      dueSoon: 0,
      assignees: 0,
      completion: 0,
    });
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
