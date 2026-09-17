import { and, asc, eq, gte } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { activityTable, taskTable } from "../../database/schema";
import type { PROJECT_CHART_RANGES, PROJECT_CHART_UNITS } from "../schema";

export type ProjectChartsRange = (typeof PROJECT_CHART_RANGES)[number];
export type ProjectChartsUnit = (typeof PROJECT_CHART_UNITS)[number];

export type ProjectChartsBucket = {
  // ISO 8601 start of the bucket (UTC), truncated to the requested unit.
  bucketStart: string;
  created: number;
  completed: number;
};

const DEFAULT_RANGE: ProjectChartsRange = "1m";
const DEFAULT_UNIT: ProjectChartsUnit = "day";

// Bucket sizes a window can carry; finer sizes are rejected so a chart cannot
// request an oversized series. Mirrored by the dashboard, which disables the
// unsupported combinations instead of sending them.
const ALLOWED_UNITS: Record<ProjectChartsRange, ProjectChartsUnit[]> = {
  "1w": ["hour", "day", "week"],
  "1m": ["day", "week"],
  "3m": ["day", "week", "month"],
  "6m": ["day", "week", "month"],
  "12m": ["day", "week", "month"],
  all: ["week", "month"],
};

// Second guardrail for long histories: "all" is unbounded, so cap the series.
const MAX_BUCKETS = 1000;

function defaultUnitForRange(range: ProjectChartsRange): ProjectChartsUnit {
  return ALLOWED_UNITS[range].includes(DEFAULT_UNIT) ? DEFAULT_UNIT : "week";
}

function toWeekStart(date: Date): Date {
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = result.getUTCDay();
  result.setUTCDate(result.getUTCDate() - ((day + 6) % 7));
  return result;
}

function floorToUnit(date: Date, unit: ProjectChartsUnit): Date {
  if (unit === "hour") {
    const result = new Date(date);
    result.setUTCMinutes(0, 0, 0);
    return result;
  }

  if (unit === "day") {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  if (unit === "month") {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  return toWeekStart(date);
}

function advance(cursor: Date, unit: ProjectChartsUnit): void {
  if (unit === "hour") {
    cursor.setUTCHours(cursor.getUTCHours() + 1);
    return;
  }
  if (unit === "day") {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    return;
  }
  if (unit === "week") {
    cursor.setUTCDate(cursor.getUTCDate() + 7);
    return;
  }
  // setUTCMonth keeps calendar months aligned regardless of their length.
  cursor.setUTCMonth(cursor.getUTCMonth() + 1);
}

// Window start, always snapped to the bucket so the first bucket is complete.
// "1w" covers the current week (Monday start whichever the bucket size, so the
// covered period does not change with the unit); "all" starts at the
// project's earliest task.
async function rangeStartFor(
  projectId: string,
  range: ProjectChartsRange,
  unit: ProjectChartsUnit,
): Promise<Date> {
  const now = new Date();
  if (range === "1w") return toWeekStart(now);

  if (range !== "all") {
    const months = Number.parseInt(range, 10);
    const start = new Date(now);
    start.setUTCMonth(start.getUTCMonth() - months);
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    return floorToUnit(start, unit);
  }

  const [earliest] = await db
    .select({ createdAt: taskTable.createdAt })
    .from(taskTable)
    .where(eq(taskTable.projectId, projectId))
    .orderBy(asc(taskTable.createdAt))
    .limit(1);

  return floorToUnit(earliest?.createdAt ?? now, unit);
}

function assertSupported(
  range: ProjectChartsRange,
  unit: ProjectChartsUnit,
): void {
  if (!ALLOWED_UNITS[range].includes(unit)) {
    throw new HTTPException(400, {
      message: `Unit "${unit}" is not supported for range "${range}".`,
    });
  }
}

function assertBucketBudget(rangeStart: Date, unit: ProjectChartsUnit): void {
  const now = new Date();
  const cursor = new Date(rangeStart);
  let count = 0;
  while (cursor <= now) {
    count += 1;
    if (count > MAX_BUCKETS) {
      throw new HTTPException(400, {
        message: `The range has more than ${MAX_BUCKETS} buckets at "${unit}" unit; use a coarser unit or a narrower range.`,
      });
    }
    advance(cursor, unit);
  }
}

async function getProjectCharts(
  projectId: string,
  range: ProjectChartsRange = DEFAULT_RANGE,
  unit?: ProjectChartsUnit,
): Promise<ProjectChartsBucket[]> {
  // The unit follows the window unless the caller picks one; "all" has no
  // daily reading, so it falls back to weekly buckets.
  const resolvedUnit = unit ?? defaultUnitForRange(range);
  assertSupported(range, resolvedUnit);

  const now = new Date();
  const rangeStart = await rangeStartFor(projectId, range, resolvedUnit);
  assertBucketBudget(rangeStart, resolvedUnit);

  // Bucket in JS: SQLite has no date_trunc, and the rows in range are already
  // bounded by project + window.
  const createdRows = await db
    .select({ createdAt: taskTable.createdAt })
    .from(taskTable)
    .where(
      and(
        eq(taskTable.projectId, projectId),
        gte(taskTable.createdAt, rangeStart),
      ),
    );

  const completedRows = await db
    .select({
      createdAt: activityTable.createdAt,
      eventData: activityTable.eventData,
    })
    .from(activityTable)
    .innerJoin(taskTable, eq(activityTable.taskId, taskTable.id))
    .where(
      and(
        eq(taskTable.projectId, projectId),
        eq(activityTable.type, "status_changed"),
        gte(activityTable.createdAt, rangeStart),
      ),
    );

  const createdByBucket = new Map<string, number>();
  for (const row of createdRows) {
    const key = floorToUnit(row.createdAt, resolvedUnit).toISOString();
    createdByBucket.set(key, (createdByBucket.get(key) ?? 0) + 1);
  }

  const completedByBucket = new Map<string, number>();
  for (const row of completedRows) {
    const status = (row.eventData as { newStatus?: string } | null)?.newStatus;
    if (status !== "done" && status !== "archived") {
      continue;
    }
    const key = floorToUnit(row.createdAt, resolvedUnit).toISOString();
    completedByBucket.set(key, (completedByBucket.get(key) ?? 0) + 1);
  }

  const buckets: ProjectChartsBucket[] = [];
  const cursor = new Date(rangeStart);
  while (cursor <= now) {
    const key = cursor.toISOString();
    buckets.push({
      bucketStart: key,
      created: createdByBucket.get(key) ?? 0,
      completed: completedByBucket.get(key) ?? 0,
    });
    advance(cursor, resolvedUnit);
  }

  return buckets;
}

export default getProjectCharts;
