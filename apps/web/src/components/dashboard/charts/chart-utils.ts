import type { ProjectChartsBucket } from "@/fetchers/project/get-project-charts";
import type { ChartUnit } from "@/store/user-preferences";

// Scale ceilings with integer halves so the 50% tick label stays clean.
const SCALE_STEPS = [
  2, 4, 6, 8, 12, 16, 20, 30, 40, 60, 80, 100, 150, 200, 300, 500, 1000,
];

export function niceMax(value: number) {
  return (
    SCALE_STEPS.find((step) => step >= value) ?? Math.ceil(value / 1000) * 1000
  );
}

const UTC = { timeZone: "UTC" } as const;

// Tooltip header: the full instant of the bucket, precise enough for its size.
export function formatBucket(bucketStart: string, unit: ChartUnit) {
  const date = new Date(bucketStart);
  if (unit === "hour") {
    return date.toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      ...UTC,
    });
  }
  if (unit === "month") {
    return date.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
      ...UTC,
    });
  }
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...UTC,
  });
}

// Axis label for a bucket, kept short so ticks do not collide.
export function formatBucketTick(bucketStart: string, unit: ChartUnit) {
  const date = new Date(bucketStart);
  if (unit === "hour") {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      ...UTC,
    });
  }
  if (unit === "month") {
    return date.toLocaleDateString(undefined, { month: "short", ...UTC });
  }
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...UTC,
  });
}

// One label per calendar boundary (day changes for hourly buckets, month
// changes for daily and weekly ones, every month for monthly buckets),
// thinned out when labels would collide. Sparse boundaries fall back to evenly
// spaced ticks so short windows still get a readable axis.
export function tickIndexes(buckets: ProjectChartsBucket[], unit: ChartUnit) {
  if (buckets.length === 0) {
    return [];
  }

  const indexed = buckets.map((bucket, index) => ({ bucket, index }));
  const isBoundary = ({ bucket, index }: (typeof indexed)[number]) => {
    if (index === 0) {
      return true;
    }
    const current = new Date(bucket.bucketStart);
    const previous = new Date(
      buckets[index - 1]?.bucketStart ?? bucket.bucketStart,
    );
    if (unit === "hour") {
      return current.getUTCHours() === 0;
    }
    if (unit === "day") {
      return current.getUTCDate() === 1;
    }
    if (unit === "month") {
      return true;
    }
    return current.getUTCMonth() !== previous.getUTCMonth();
  };

  const boundaries = indexed.filter(isBoundary);
  if (boundaries.length > 1 && boundaries.length <= 7) {
    return boundaries;
  }

  const step = Math.ceil(buckets.length / 6);
  return indexed.filter(
    ({ index }) => index % step === 0 || index === buckets.length - 1,
  );
}

// Shared progression shape: cumulative tasks and remaining backlog per bucket.
export function cumulativeBuckets(buckets: ProjectChartsBucket[]) {
  let created = 0;
  let completed = 0;
  return buckets.map((bucket) => {
    created += bucket.created;
    completed += bucket.completed;
    return {
      bucketStart: bucket.bucketStart,
      created: bucket.created,
      completed: bucket.completed,
      tasks: created,
      // "Backlog" is the remaining work: created minus finished, floored at 0
      // so data gaps (deleted tasks) can't make it negative.
      backlog: Math.max(0, created - completed),
    };
  });
}

// Buckets from several projects share the same window; sum them per bucket
// (and keep the window sorted) to read the whole board at once.
export function aggregateBuckets(
  snapshots: Array<ProjectChartsBucket[] | undefined>,
) {
  const byBucket = new Map<string, ProjectChartsBucket>();
  for (const buckets of snapshots) {
    for (const bucket of buckets ?? []) {
      const current = byBucket.get(bucket.bucketStart) ?? {
        bucketStart: bucket.bucketStart,
        created: 0,
        completed: 0,
      };
      current.created += bucket.created;
      current.completed += bucket.completed;
      byBucket.set(bucket.bucketStart, current);
    }
  }
  return [...byBucket.values()].sort((a, b) =>
    a.bucketStart.localeCompare(b.bucketStart),
  );
}

// Average completions per bucket over the selected window; the unit
// decides whether that reads as per hour, per day, per week or per month.
export function averageCompleted(buckets: ProjectChartsBucket[]) {
  if (buckets.length === 0) return 0;
  const completed = buckets.reduce((sum, bucket) => sum + bucket.completed, 0);
  return completed / buckets.length;
}
