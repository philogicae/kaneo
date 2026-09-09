import { and, eq, gte, sql } from "drizzle-orm";
import db from "../../database";
import { activityTable, taskTable } from "../../database/schema";

export type ProjectChartsBucket = {
  // ISO date of the week start (Monday, UTC).
  weekStart: string;
  created: number;
  completed: number;
};

function toWeekStart(date: Date): Date {
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = result.getUTCDay();
  result.setUTCDate(result.getUTCDate() - ((day + 6) % 7));
  return result;
}

async function getProjectCharts(
  projectId: string,
  months = 6,
): Promise<ProjectChartsBucket[]> {
  const now = new Date();
  const start = new Date(now);
  start.setUTCMonth(start.getUTCMonth() - months);
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const rangeStart = toWeekStart(start);

  const createdRows = await db
    .select({
      week: sql<string>`date_trunc('week', ${taskTable.createdAt})::date::text`,
      total: sql<number>`count(*)::int`,
    })
    .from(taskTable)
    .where(
      and(
        eq(taskTable.projectId, projectId),
        gte(taskTable.createdAt, rangeStart),
      ),
    )
    .groupBy(sql`1`);

  const completedRows = await db
    .select({
      week: sql<string>`date_trunc('week', ${activityTable.createdAt})::date::text`,
      total: sql<number>`count(*)::int`,
    })
    .from(activityTable)
    .innerJoin(taskTable, eq(activityTable.taskId, taskTable.id))
    .where(
      and(
        eq(taskTable.projectId, projectId),
        eq(activityTable.type, "status_changed"),
        sql`${activityTable.eventData}->>'newStatus' in ('done', 'archived')`,
        gte(activityTable.createdAt, rangeStart),
      ),
    )
    .groupBy(sql`1`);

  const createdByWeek = new Map(
    createdRows.map((row) => [row.week, row.total]),
  );
  const completedByWeek = new Map(
    completedRows.map((row) => [row.week, row.total]),
  );

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
