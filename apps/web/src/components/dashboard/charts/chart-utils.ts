import type { ProjectChartsBucket } from "@/fetchers/project/get-project-charts";

// Scale ceilings with integer halves so the 50% tick label stays clean.
const SCALE_STEPS = [
  2, 4, 6, 8, 12, 16, 20, 30, 40, 60, 80, 100, 150, 200, 300, 500, 1000,
];

export function niceMax(value: number) {
  return (
    SCALE_STEPS.find((step) => step >= value) ?? Math.ceil(value / 1000) * 1000
  );
}

export function formatWeekStart(weekStart: string) {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatMonth(weekStart: string) {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    timeZone: "UTC",
  });
}

// One label per month change, thinned out when labels would collide. The
// thinning runs on the tick positions (not the bucket indexes) so the kept
// labels stay evenly spaced.
export function monthTickIndexes(buckets: ProjectChartsBucket[]) {
  const ticks = buckets
    .map((bucket, index) => ({ bucket, index }))
    .filter(
      ({ bucket, index }, _, all) =>
        index === 0 ||
        bucket.weekStart.slice(5, 7) !==
          all[index - 1]?.bucket.weekStart.slice(5, 7),
    );
  if (ticks.length <= 7) {
    return ticks;
  }
  const step = Math.ceil(ticks.length / 6);
  return ticks.filter(
    (_, position) => position % step === 0 || position === ticks.length - 1,
  );
}

// Shared progression shape: cumulative tasks and remaining backlog per week.
export function cumulativeBuckets(buckets: ProjectChartsBucket[]) {
  let created = 0;
  let completed = 0;
  return buckets.map((bucket) => {
    created += bucket.created;
    completed += bucket.completed;
    return {
      weekStart: bucket.weekStart,
      created: bucket.created,
      completed: bucket.completed,
      tasks: created,
      // "Backlog" is the remaining work: created minus finished, floored at 0
      // so data gaps (deleted tasks) can't make it negative.
      backlog: Math.max(0, created - completed),
    };
  });
}

// Weekly buckets from several projects share the same window; sum them per
// week (and keep the window sorted) to read the whole board at once.
export function aggregateBuckets(
  snapshots: Array<ProjectChartsBucket[] | undefined>,
) {
  const byWeek = new Map<string, ProjectChartsBucket>();
  for (const buckets of snapshots) {
    for (const bucket of buckets ?? []) {
      const current = byWeek.get(bucket.weekStart) ?? {
        weekStart: bucket.weekStart,
        created: 0,
        completed: 0,
      };
      current.created += bucket.created;
      current.completed += bucket.completed;
      byWeek.set(bucket.weekStart, current);
    }
  }
  return [...byWeek.values()].sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  );
}

// Average completions per week over the trailing window, the usual velocity
// reading; falls back to the whole window when there are fewer weeks.
export function recentVelocity(buckets: ProjectChartsBucket[], weeks = 4) {
  const window = buckets.slice(-weeks);
  if (window.length === 0) return 0;
  const completed = window.reduce((sum, bucket) => sum + bucket.completed, 0);
  return completed / window.length;
}
