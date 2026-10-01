import { and, asc, eq, gte, inArray, lte, max, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  columnTable,
  externalLinkTable,
  labelTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { getSubtaskCounts } from "../get-subtask-counts";
import { buildTaskOrderBy, type TaskSortField } from "../task-order";

export type GetTasksOptions = {
  /**
   * Serve an anonymous public-project view. The rows are the same either way;
   * the flag only adds the revision strings a shared cache needs to notice an
   * edit to a card loaded on an earlier page.
   */
  publicOnly?: boolean;
  assigneeId?: string;
  dueAfter?: string;
  dueBefore?: string;
  limit?: number;
  page?: number;
  priority?: string;
  sortBy?: TaskSortField;
  sortOrder?: "asc" | "desc";
  status?: string;
};

async function getTasks(projectId: string, options: GetTasksOptions = {}) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  const conditions = [eq(taskTable.projectId, projectId)];

  if (options.status) {
    conditions.push(eq(taskTable.status, options.status));
  }

  if (options.priority) {
    conditions.push(eq(taskTable.priority, options.priority));
  }

  if (options.assigneeId) {
    conditions.push(eq(taskTable.userId, options.assigneeId));
  }

  if (options.dueBefore) {
    conditions.push(lte(taskTable.dueDate, new Date(options.dueBefore)));
  }

  if (options.dueAfter) {
    conditions.push(gte(taskTable.dueDate, new Date(options.dueAfter)));
  }

  const whereClause = and(...conditions);
  const usePagination = options.page != null || options.limit != null;
  const page = options.page && options.page > 0 ? options.page : 1;
  const pageSize =
    options.limit && options.limit > 0 ? Math.min(options.limit, 200) : 50;
  const offset = (page - 1) * pageSize;

  const orderByClause = buildTaskOrderBy(
    options.sortBy ?? "position",
    options.sortOrder ?? "asc",
  );

  const [taskCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(taskTable)
    .where(whereClause);

  const total = Number(taskCount?.count ?? 0);

  // Public pages are cacheable, so they need a cheap signal that a card or a
  // label/link on another page changed. The newest row timestamp across the
  // project's related data is enough, and needs no Postgres hash aggregate.
  let relatedRevision = "0";
  if (options.publicOnly) {
    const [labelRow] = await db
      .select({ updatedAt: max(labelTable.updatedAt) })
      .from(labelTable)
      .innerJoin(taskTable, eq(labelTable.taskId, taskTable.id))
      .where(eq(taskTable.projectId, projectId));
    const [linkRow] = await db
      .select({ updatedAt: max(externalLinkTable.updatedAt) })
      .from(externalLinkTable)
      .innerJoin(taskTable, eq(externalLinkTable.taskId, taskTable.id))
      .where(eq(taskTable.projectId, projectId));
    relatedRevision = `${labelRow?.updatedAt?.getTime() ?? 0}:${
      linkRow?.updatedAt?.getTime() ?? 0
    }`;
  }

  const taskSelection = {
    id: taskTable.id,
    title: taskTable.title,
    number: taskTable.number,
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
    projectId: taskTable.projectId,
  };

  const query = db
    .select(taskSelection)
    .from(taskTable)
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(whereClause)
    .orderBy(orderByClause);

  const paginatedTasks = usePagination
    ? await query.limit(pageSize).offset(offset)
    : await query;

  const taskIds = paginatedTasks.map((task) => task.id);

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

  const externalLinksData =
    taskIds.length > 0
      ? await db
          .select()
          .from(externalLinkTable)
          .where(inArray(externalLinkTable.taskId, taskIds))
      : [];

  const taskLabelsMap = new Map<
    string,
    Array<{ id: string; name: string; color: string }>
  >();
  for (const label of labelsData) {
    if (label.taskId) {
      if (!taskLabelsMap.has(label.taskId)) {
        taskLabelsMap.set(label.taskId, []);
      }
      taskLabelsMap.get(label.taskId)?.push({
        id: label.id,
        name: label.name,
        color: label.color,
      });
    }
  }

  const taskExternalLinksMap = new Map<
    string,
    Array<{
      id: string;
      taskId: string;
      // Null for a link a user added by hand rather than one a forge webhook
      // created for an integration.
      integrationId: string | null;
      resourceType: string;
      externalId: string;
      url: string;
      title: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  >();
  for (const externalLink of externalLinksData) {
    if (!taskExternalLinksMap.has(externalLink.taskId)) {
      taskExternalLinksMap.set(externalLink.taskId, []);
    }
    taskExternalLinksMap.get(externalLink.taskId)?.push({
      ...externalLink,
      metadata: externalLink.metadata
        ? JSON.parse(externalLink.metadata)
        : null,
    });
  }

  const projectColumns = await db
    .select()
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId))
    .orderBy(asc(columnTable.position));

  // Progress over direct children is board-filter independent, so it is loaded
  // for the whole page rather than per column.
  const subtaskCounts = await getSubtaskCounts(
    db,
    paginatedTasks.map((task) => task.id),
    project.workspaceId,
    options.publicOnly ?? false,
  );
  const withRelations = (task: (typeof paginatedTasks)[number]) => ({
    ...task,
    labels: taskLabelsMap.get(task.id) || [],
    externalLinks: taskExternalLinksMap.get(task.id) || [],
    subtaskCounts: subtaskCounts.get(task.id) ?? { completed: 0, total: 0 },
  });

  const columns = projectColumns.map((column) => ({
    id: column.slug,
    slug: column.slug,
    name: column.name,
    icon: column.icon,
    isFinal: column.isFinal,
    tasks: paginatedTasks
      .filter((task) => task.status === column.slug)
      .map(withRelations),
  }));

  const archivedTasks = paginatedTasks
    .filter((task) => task.status === "archived")
    .map(withRelations);

  const plannedTasks = paginatedTasks
    .filter((task) => task.status === "planned")
    .map(withRelations);

  return {
    data: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      icon: project.icon,
      description: project.description,
      isPublic: project.isPublic,
      workspaceId: project.workspaceId,
      backgroundVersion: project.backgroundVersion,
      columns,
      archivedTasks,
      plannedTasks,
    },
    pagination: {
      total,
      // Anonymous public pages are cacheable, so they carry a revision that
      // changes whenever a card on an earlier page could have changed. Built
      // from the newest task/label/link timestamps rather than a Postgres hash
      // aggregate, which libSQL has no equivalent for.
      ...(options.publicOnly
        ? {
            revision: `${project.backgroundVersion ?? ""}:${project.createdAt.getTime()}:${total}:${relatedRevision}`,
          }
        : {}),
      page: usePagination ? page : 1,
      pageSize: usePagination ? pageSize : total,
      totalPages: usePagination ? Math.max(1, Math.ceil(total / pageSize)) : 1,
    },
  };
}

export default getTasks;
