import {
  and,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import db from "../../database";
import {
  labelTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { getScopedProjectIds } from "../../utils/access-scope";
import { buildTaskOrderBy, type TaskSortField } from "../task-order";

export type WorkspaceTasksOptions = {
  assigneeId?: string;
  dueAfter?: string;
  dueBefore?: string;
  label?: string;
  limit?: number;
  page?: number;
  priority?: string;
  q?: string;
  sortBy?: TaskSortField;
  sortOrder?: "asc" | "desc";
  status?: string;
};

// Sentinel accepted by `assigneeId`: tasks with no assignee at all.
export const UNASSIGNED_FILTER = "unassigned";

/**
 * Flat, filterable task list across every project of one workspace the caller
 * can see. Unlike the per-project board, this answers "my open tasks", "what
 * is urgent", "what is due this week" or "tasks with label X" in one call.
 * Project scoping follows the same access rules as global search: a scoped
 * member only reads the projects they were granted.
 */
async function getWorkspaceTasks(
  workspaceId: string,
  userId: string,
  options: WorkspaceTasksOptions = {},
) {
  const scopedProjectIds = await getScopedProjectIds(userId, workspaceId);

  const page = options.page && options.page > 0 ? options.page : 1;
  const pageSize =
    options.limit && options.limit > 0 ? Math.min(options.limit, 200) : 50;
  const offset = (page - 1) * pageSize;

  // A scoped member with no project grant can reach the workspace but sees no
  // tasks; an empty page is the honest answer, not an error.
  if (scopedProjectIds !== null && scopedProjectIds.length === 0) {
    return {
      tasks: [],
      pagination: { total: 0, page, pageSize, totalPages: 1 },
    };
  }

  const conditions: Array<SQL | undefined> = [
    eq(projectTable.workspaceId, workspaceId),
  ];
  if (scopedProjectIds !== null) {
    conditions.push(inArray(taskTable.projectId, scopedProjectIds));
  }
  if (options.status) {
    conditions.push(eq(taskTable.status, options.status));
  }
  if (options.priority) {
    conditions.push(eq(taskTable.priority, options.priority));
  }
  if (options.assigneeId === UNASSIGNED_FILTER) {
    conditions.push(isNull(taskTable.userId));
  } else if (options.assigneeId) {
    conditions.push(eq(taskTable.userId, options.assigneeId));
  }
  if (options.dueBefore) {
    conditions.push(lte(taskTable.dueDate, new Date(options.dueBefore)));
  }
  if (options.dueAfter) {
    conditions.push(gte(taskTable.dueDate, new Date(options.dueAfter)));
  }
  if (options.q) {
    const pattern = `%${options.q.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`lower(${taskTable.title})`, pattern),
        like(sql`lower(${taskTable.description})`, pattern),
      ),
    );
  }
  if (options.label) {
    const labelTasks = db
      .select({ taskId: labelTable.taskId })
      .from(labelTable)
      .where(
        and(
          sql`lower(${labelTable.name}) = ${options.label.toLowerCase()}`,
          isNotNull(labelTable.taskId),
        ),
      );
    conditions.push(inArray(taskTable.id, labelTasks));
  }

  const whereClause = and(...conditions);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(whereClause);
  const total = Number(countRow?.count ?? 0);

  const rows = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      projectName: projectTable.name,
      projectSlug: projectTable.slug,
      number: taskTable.number,
      title: taskTable.title,
      description: taskTable.description,
      status: taskTable.status,
      milestoneId: taskTable.milestoneId,
      priority: taskTable.priority,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
      reminderOffsets: taskTable.reminderOffsets,
      recurrence: taskTable.recurrence,
      position: taskTable.position,
      createdAt: taskTable.createdAt,
      userId: taskTable.userId,
      assigneeName: userTable.name,
      assigneeId: userTable.id,
      assigneeImage: userTable.image,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .where(whereClause)
    .orderBy(buildTaskOrderBy(options.sortBy, options.sortOrder))
    .limit(pageSize)
    .offset(offset);

  const taskIds = rows.map((row) => row.id);
  const labelsData =
    taskIds.length > 0
      ? await db
          .select({
            id: labelTable.id,
            name: labelTable.name,
            color: labelTable.color,
            taskId: labelTable.taskId,
          })
          .from(labelTable)
          .where(inArray(labelTable.taskId, taskIds))
      : [];

  const labelsByTask = new Map<
    string,
    Array<{ id: string; name: string; color: string }>
  >();
  for (const label of labelsData) {
    if (!label.taskId) continue;
    const list = labelsByTask.get(label.taskId) ?? [];
    list.push({ id: label.id, name: label.name, color: label.color });
    labelsByTask.set(label.taskId, list);
  }

  return {
    tasks: rows.map((row) => ({
      ...row,
      labels: labelsByTask.get(row.id) ?? [],
    })),
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export default getWorkspaceTasks;
