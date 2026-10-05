import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  sql,
} from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  labelTable,
  projectTable,
  taskTable,
} from "../../database/schema";
import { taskIsCompleted } from "../task-is-completed";

// Home and My tasks render this list whole, so it stays one bounded page.
export const ASSIGNED_TASKS_LIMIT = 100;

const priorityRank = sql<number>`CASE
  WHEN ${taskTable.priority} = 'urgent' THEN 4
  WHEN ${taskTable.priority} = 'high' THEN 3
  WHEN ${taskTable.priority} = 'medium' THEN 2
  WHEN ${taskTable.priority} = 'low' THEN 1
  ELSE 0
END`;

async function getAssignedTasks(
  workspaceId: string,
  userId: string,
  countOnly = false,
) {
  const openAndMine = and(
    eq(projectTable.workspaceId, workspaceId),
    isNull(projectTable.archivedAt),
    eq(taskTable.userId, userId),
    ne(taskTable.status, "archived"),
    sql`not coalesce((
      select ${columnTable.isFinal} from ${columnTable}
      where ${columnTable.id} = ${taskTable.columnId}
        and ${columnTable.projectId} = ${taskTable.projectId}
    ), ${taskIsCompleted})`,
  );

  const totalsQuery = db
    .select({ total: count() })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(openAndMine);

  if (countOnly) {
    const [totals] = await totalsQuery;
    return { tasks: [], total: Number(totals?.total ?? 0) };
  }

  const [tasks, [totals]] = await Promise.all([
    db
      .select({
        id: taskTable.id,
        projectId: taskTable.projectId,
        number: taskTable.number,
        title: taskTable.title,
        status: taskTable.status,
        columnId: taskTable.columnId,
        priority: taskTable.priority,
        dueDate: taskTable.dueDate,
        projectName: projectTable.name,
        projectSlug: projectTable.slug,
        projectIcon: projectTable.icon,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .where(openAndMine)
      .orderBy(
        sql`${taskTable.dueDate} asc nulls last`,
        desc(priorityRank),
        asc(taskTable.createdAt),
        asc(taskTable.id),
      )
      .limit(ASSIGNED_TASKS_LIMIT),
    totalsQuery,
  ]);

  const taskIds = tasks.map((task) => task.id);

  // SQLite has no LATERAL, so the column name and icon are stitched in from a
  // second query. Existing databases can hold duplicate slugs from concurrent
  // column creation, so prefer the task's own column and fall back to the
  // earliest one matching the slug.
  const columns = taskIds.length
    ? await db
        .select({
          projectId: columnTable.projectId,
          slug: columnTable.slug,
          name: columnTable.name,
          icon: columnTable.icon,
          id: columnTable.id,
          position: columnTable.position,
          createdAt: columnTable.createdAt,
        })
        .from(columnTable)
        .where(
          and(
            inArray(columnTable.projectId, [
              ...new Set(tasks.map((task) => task.projectId)),
            ]),
          ),
        )
    : [];

  // Existing databases can hold duplicate slugs from concurrent column
  // creation, so prefer the task's own column over the earliest match.
  const columnsByProject = new Map<
    string,
    Array<{
      slug: string;
      name: string;
      icon: string | null;
      id: string;
      position: number;
      createdAt: number;
    }>
  >();
  for (const column of columns) {
    const list = columnsByProject.get(column.projectId) ?? [];
    list.push({
      slug: column.slug,
      name: column.name,
      icon: column.icon,
      id: column.id,
      position: column.position,
      createdAt: column.createdAt.getTime(),
    });
    columnsByProject.set(column.projectId, list);
  }

  const columnByTask = new Map<string, { name: string; icon: string | null }>();
  for (const task of tasks) {
    const candidates = (columnsByProject.get(task.projectId) ?? [])
      .filter((column) => column.slug === task.status)
      .sort((a, b) => {
        if (a.id === task.columnId) return -1;
        if (b.id === task.columnId) return 1;
        return a.position - b.position || a.createdAt - b.createdAt;
      });
    const column = candidates[0];
    if (column)
      columnByTask.set(task.id, { name: column.name, icon: column.icon });
  }

  const labels = taskIds.length
    ? await db
        .select({
          id: labelTable.id,
          name: labelTable.name,
          color: labelTable.color,
          taskId: labelTable.taskId,
        })
        .from(labelTable)
        .where(inArray(labelTable.taskId, taskIds))
        .orderBy(asc(labelTable.name), asc(labelTable.id))
    : [];

  const labelsByTask = new Map<
    string,
    Array<{ id: string; name: string; color: string }>
  >();
  for (const { taskId, ...label } of labels) {
    if (!taskId) continue;
    const taskLabels = labelsByTask.get(taskId) ?? [];
    taskLabels.push(label);
    labelsByTask.set(taskId, taskLabels);
  }

  return {
    tasks: tasks.map((task) => ({
      ...task,
      statusName: columnByTask.get(task.id)?.name ?? null,
      statusIcon: columnByTask.get(task.id)?.icon ?? null,
      labels: labelsByTask.get(task.id) ?? [],
    })),
    total: Number(totals?.total ?? 0),
  };
}

export default getAssignedTasks;
