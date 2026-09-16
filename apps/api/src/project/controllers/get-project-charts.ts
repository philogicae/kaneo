import { and, asc, eq, gte } from "drizzle-orm";
import db from "../../database";
import { activityTable, taskTable } from "../../database/schema";
import type { PROJECT_CHART_RANGES } from "../schema";

export type ProjectChartsRange = (typeof PROJECT_CHART_RANGES)[number];

export type ProjectChartsBucket = {
  // ISO date of the week start (Monday, UTC).
  weekStart: string;
  created: number;
  completed: number;
};

const DEFAULT_RANGE: ProjectChartsRange = "6m";

function toWeekStart(date: Date): Date {
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = result.getUTCDay();
  result.setUTCDate(result.getUTCDate() - ((day + 6) % 7));
  return result;
}

function weekKey(date: Date): string {
  return toWeekStart(date).toISOString().slice(0, 10);
}

// Window start, always snapped to a week so the first bucket is complete.
// "1w" covers the current week; "all" starts at the project's earliest task.
async function rangeStartFor(
  projectId: string,
  range: ProjectChartsRange,
): Promise<Date> {
  const now = new Date();
  if (range === "1w") return toWeekStart(now);

  if (range !== "all") {
    const months = Number.parseInt(range, 10);
    const start = new Date(now);
    start.setUTCMonth(start.getUTCMonth() - months);
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    return toWeekStart(start);
  }

  const [earliest] = await db
    .select({ createdAt: taskTable.createdAt })
    .from(taskTable)
    .where(eq(taskTable.projectId, projectId))
    .orderBy(asc(taskTable.createdAt))
    .limit(1);

  return toWeekStart(earliest?.createdAt ?? now);
}

async function getProjectCharts(
  projectId: string,
  range: ProjectChartsRange = DEFAULT_RANGE,
): Promise<ProjectChartsBucket[]> {
  const now = new Date();
  const rangeStart = await rangeStartFor(projectId, range);

  // Bucket by week in JS: SQLite has no date_trunc, and the rows in range are
  // already bounded by project + window.
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

  const createdByWeek = new Map<string, number>();
  for (const row of createdRows) {
    const key = weekKey(row.createdAt);
    createdByWeek.set(key, (createdByWeek.get(key) ?? 0) + 1);
  }

  const completedByWeek = new Map<string, number>();
  for (const row of completedRows) {
    const status = (row.eventData as { newStatus?: string } | null)?.newStatus;
    if (status !== "done" && status !== "archived") {
      continue;
    }
    const key = weekKey(row.createdAt);
    completedByWeek.set(key, (completedByWeek.get(key) ?? 0) + 1);
  }

  const buckets: ProjectChartsBucket[] = [];
  const cursor = new Date(rangeStart);
  while (cursor <= now) {
    const key = cursor.toISOString().slice(0, 10);
    buckets.push({
      weekStart: key,
      created: createdByWeek.get(key) ?? 0,
      completed: completedByWeek.get(key) ?? 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return buckets;
}

export default getProjectCharts;
