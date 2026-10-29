import type { ProjectChartsBucket } from "@/fetchers/project/get-project-charts";
import type { ChartScale, ChartUnit } from "@/store/user-preferences";

export type DisplayBucket = ProjectChartsBucket & {
  /** Last bucket covered when several dense buckets were merged for display. */
  bucketEnd?: string;
};

export type ProjectTaskStats = {
  total: number;
  open: number;
  done: number;
  backlog: number;
  overdue: number;
  dueSoon: number;
  assignees: number;
  completion: number;
};

type StatsColumn = {
  isFinal: boolean;
  tasks?: Array<{
    dueDate?: string | null;
    assigneeId?: string | null;
  }>;
};

type StatsData = {
  columns?: StatsColumn[];
  plannedTasks?: unknown[];
};

// Scale ceilings with integer halves so the 50% tick label stays clean.
const SCALE_STEPS = [
  2, 4, 6, 8, 12, 16, 20, 30, 40, 60, 80, 100, 150, 200, 300, 500, 1000,
];

export function niceMax(value: number) {
  return (
    SCALE_STEPS.find((step) => step >= value) ?? Math.ceil(value / 1000) * 1000
  );
}

export type AxisTick = {
  value: number;
  /** Position on the axis, 0 at the baseline and 1 at the top. */
  ratio: number;
};

// Log axes round up to 1/2/5 × a power of ten so their top label stays round
// (194 → 200) without the headroom a linear scale would add.
function niceLogMax(rawMax: number) {
  const max = Math.max(1, rawMax);
  const magnitude = 10 ** Math.ceil(Math.log10(max));
  const normalized = max / magnitude;
  if (normalized <= 0.2) return magnitude / 5;
  if (normalized <= 0.5) return magnitude / 2;
  return magnitude;
}

export function chartAxisMax(rawMax: number, scale: ChartScale) {
  return scale === "log" ? niceLogMax(rawMax) : niceMax(rawMax);
}

// log1p maps 0 to 0, so the baseline stays valid while every non-zero value
// keeps a readable gap from its neighbours on a long-running project.
export function chartRatio(value: number, axisMax: number, scale: ChartScale) {
  if (axisMax <= 0) {
    return 0;
  }
  if (scale === "log") {
    return Math.log1p(Math.max(0, value)) / Math.log1p(axisMax);
  }
  return Math.max(0, value) / axisMax;
}

// Ticks stay round on a log axis (1, 10, 100, …), plus the exact maximum when
// it is far enough from the previous power of ten to deserve its own label.
export function chartAxisTicks(axisMax: number, scale: ChartScale): AxisTick[] {
  if (scale === "linear") {
    return [
      { value: axisMax, ratio: 1 },
      { value: axisMax / 2, ratio: 0.5 },
      { value: 0, ratio: 0 },
    ];
  }

  const max = Math.max(1, axisMax);
  const values = [0];
  for (let step = 1; step <= max; step *= 10) {
    values.push(step);
  }
  const lastPower = values.at(-1) ?? 1;
  if (max / lastPower >= 2) {
    values.push(max);
  }

  return [...new Set(values)]
    .filter((value) => value <= max)
    .sort((left, right) => left - right)
    .map((value) => ({ value, ratio: chartRatio(value, max, scale) }));
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
      // Per-bucket completions, used by the summary and the tooltip.
      completed: bucket.completed,
      // Running total of completed tasks: a line that only rises, so "Done"
      // does not fall back to zero on days without a status change.
      done: completed,
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

// Dense windows (one year at day granularity, 365 buckets) cannot fit in a
// card without horizontal scrolling. Merge adjacent buckets for the drawing
// only; counts stay exact in the tooltip range and the summary totals.
export function compressBuckets(
  buckets: ProjectChartsBucket[],
  maxBuckets = 72,
): DisplayBucket[] {
  if (buckets.length <= maxBuckets) return buckets;
  const groupSize = Math.ceil(buckets.length / maxBuckets);
  const compressed: DisplayBucket[] = [];
  for (let index = 0; index < buckets.length; index += groupSize) {
    const group = buckets.slice(index, index + groupSize);
    const first = group[0];
    if (!first) continue;
    compressed.push({
      bucketStart: first.bucketStart,
      bucketEnd: group.at(-1)?.bucketStart,
      created: group.reduce((sum, bucket) => sum + bucket.created, 0),
      completed: group.reduce((sum, bucket) => sum + bucket.completed, 0),
    });
  }
  return compressed;
}

export function formatBucketRange(
  bucketStart: string,
  bucketEnd: string | undefined,
  unit: ChartUnit,
) {
  const start = formatBucket(bucketStart, unit);
  if (!bucketEnd || bucketEnd === bucketStart) return start;
  return `${start} – ${formatBucket(bucketEnd, unit)}`;
}

export function summarizeTasks(
  data: StatsData | undefined,
  now = new Date(),
): ProjectTaskStats {
  let total = 0;
  let done = 0;
  let overdue = 0;
  let dueSoon = 0;
  const assignees = new Set<string>();
  const soon = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  for (const column of data?.columns ?? []) {
    for (const task of column.tasks ?? []) {
      total += 1;
      if (column.isFinal) done += 1;
      if (task.assigneeId) assignees.add(task.assigneeId);
      if (!task.dueDate || column.isFinal) continue;
      const due = new Date(task.dueDate).getTime();
      if (Number.isNaN(due)) continue;
      if (due < now.getTime()) overdue += 1;
      else if (due <= soon) dueSoon += 1;
    }
  }
  const backlog = data?.plannedTasks?.length ?? 0;
  return {
    total,
    open: total - done,
    done,
    backlog,
    overdue,
    dueSoon,
    assignees: assignees.size,
    completion: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

// Below this share of the plot a bucket pair (two bars plus their inner gap)
// collapses under a pixel and the series looks empty even though the DOM has
// bars (12 months at day granularity packs ~385 buckets into one card).
const DENSE_BUCKET_PX = 3;
// Width a bucket gets when the plot switches to horizontal scrolling: enough
// for two visible bars plus the gap.
const DENSE_BUCKET_TARGET_PX = 6;

// Plot floor for dense series: undefined means "fill the card as before".
export function plotMinWidth(bucketCount: number, containerWidth: number) {
  if (bucketCount <= 0 || containerWidth <= 0) return undefined;
  const natural = containerWidth / bucketCount;
  if (natural >= DENSE_BUCKET_PX) return undefined;
  return Math.round(bucketCount * DENSE_BUCKET_TARGET_PX);
}
