import {
  and,
  asc,
  eq,
  getTableColumns,
  gte,
  inArray,
  lte,
  type SQL,
  sql,
  type SQLWrapper,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { HTTPException } from "hono/http-exception";
import {
  columnTable,
  externalLinkTable,
  labelTable,
  projectTable,
  taskTable,
  taskRelationTable,
  userTable,
} from "../../database/schema";
import { boundedTaskRead, type TaskReadDatabase } from "../bounded-read";
import {
  boardDescription,
  boardProjectDescription,
  descriptionDeferred,
  projectDescriptionDeferred,
} from "../description-pages";
import { getSubtaskCounts } from "../get-subtask-counts";
import { buildTaskOrderBy, sortValue, type TaskSortField } from "../task-order";
import { taskIsCompleted } from "../task-is-completed";

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
  /** Bounded read deadline, in ms; only tests override it. */
  deadlineMs?: number;
  relatedPage?: number;
  priority?: string;
  sortBy?: TaskSortField;
  sortOrder?: "asc" | "desc";
  status?: string;
};

const RELATED_PAGE_SIZE = 100;

/**
 * A digest of the rows a revision covers.
 *
 * Postgres summed `hashtextextended` over a JSON array of the columns; libSQL
 * has neither, so the same idea is a SHA3 over the ordered concatenation of the
 * same columns. `group_concat` needs an explicit order or two equal sets could
 * hash differently, and the ordering column comes first in the field list.
 */
function digest(fields: SQLWrapper[], orderBy: SQLWrapper): SQL<string> {
  // ifnull() per field: `||` with a NULL yields NULL, and group_concat skips
  // NULL entries entirely, so a row with a null column would vanish from the
  // digest instead of contributing a distinguishable value. The inner coalesce
  // covers the empty set, and SQLite needs it there anyway: an ORDER BY inside
  // a nested aggregate is only parsed inside a function call.
  const joined = sql.join(
    fields.map((field) => sql`ifnull(${field}, '')`),
    sql` || char(31) || `,
  );
  return sql<string>`coalesce(hex(sha3(coalesce(group_concat(${joined}, char(30) order by ${orderBy}), ''), 256)), '0')`;
}

/** Only public pages are cacheable, so only they pay for a revision. */
function revision(
  publicOnly: boolean | undefined,
  digest_: SQL<string>,
): SQL<string> {
  return publicOnly ? digest_ : sql<string>`'0'`;
}

async function getTasksPage(
  db: TaskReadDatabase,
  projectId: string,
  options: GetTasksOptions,
) {
  const [project] = await db
    .select({
      ...getTableColumns(projectTable),
      revision: revision(
        options.publicOnly,
        digest(
          [
            projectTable.id,
            projectTable.name,
            projectTable.slug,
            projectTable.icon,
            projectTable.isPublic,
            projectTable.description,
            projectTable.backgroundVersion,
          ],
          projectTable.id,
        ),
      ),
      description: boardProjectDescription,
      descriptionDeferred: projectDescriptionDeferred,
    })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

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
  const page = options.page && options.page > 0 ? options.page : 1;
  const pageSize =
    options.limit && options.limit > 0 ? Math.min(options.limit, 200) : 50;
  const offset = (page - 1) * pageSize;
  const relatedPage = options.relatedPage ?? 1;
  const relatedOffset = (relatedPage - 1) * RELATED_PAGE_SIZE;

  const orderByClause = buildTaskOrderBy(
    options.sortBy ?? "position",
    options.sortOrder ?? "asc",
  );

  // The count query also carries the board's task revision: every column that
  // can reorder or re-render a card across pages feeds the digest.
  const taskCountQuery = db
    .select({
      count: sql<number>`count(*)`,
      revision: revision(
        options.publicOnly,
        digest(
          [
            taskTable.id,
            sortValue(options.sortBy),
            taskTable.status,
            // The row's write counter detects content edits without hashing
            // the description, which can be large.
            taskTable.revision,
            userTable.name,
            userTable.image,
          ],
          taskTable.id,
        ),
      ),
    })
    .from(taskTable)
    .$dynamic();
  const [taskCount] = await (
    options.publicOnly
      ? taskCountQuery.leftJoin(userTable, eq(taskTable.userId, userTable.id))
      : taskCountQuery
  ).where(whereClause);

  const total = Number(taskCount?.count ?? 0);

  const taskSelection = {
    id: taskTable.id,
    title: taskTable.title,
    number: taskTable.number,
    description: boardDescription,
    descriptionDeferred,
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

  const paginatedTasks = await db
    .select(taskSelection)
    .from(taskTable)
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(whereClause)
    .orderBy(orderByClause, asc(taskTable.id))
    .limit(pageSize)
    .offset(offset);

  const taskIds = paginatedTasks.map((task) => task.id);

  const subtaskCounts = await getSubtaskCounts(
    db,
    taskIds,
    project.workspaceId,
    options.publicOnly ?? false,
  );

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
          .orderBy(asc(labelTable.id))
          .limit(RELATED_PAGE_SIZE)
          .offset(relatedOffset)
      : [];

  const externalLinksData =
    taskIds.length > 0
      ? await db
          .select()
          .from(externalLinkTable)
          .where(inArray(externalLinkTable.taskId, taskIds))
          .orderBy(asc(externalLinkTable.id))
          .limit(RELATED_PAGE_SIZE)
          .offset(relatedOffset)
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
      metadata: parseMetadata(externalLink.metadata),
    });
  }

  const projectColumns = await db
    .select()
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId))
    .orderBy(asc(columnTable.position), asc(columnTable.id))
    .limit(RELATED_PAGE_SIZE)
    .offset(relatedOffset);

  // Keep every selected task representable even when its column falls on a
  // later metadata page. At most 100 distinct task statuses can be present.
  const missingStatuses = Array.from(
    new Set(paginatedTasks.map((task) => task.status)),
  ).filter(
    (status) =>
      status !== "planned" &&
      status !== "archived" &&
      !projectColumns.some((column) => column.slug === status),
  );
  if (missingStatuses.length) {
    const taskColumns = await db
      .select()
      .from(columnTable)
      .where(
        and(
          eq(columnTable.projectId, projectId),
          inArray(columnTable.slug, missingStatuses),
        ),
      )
      .orderBy(
        asc(columnTable.slug),
        asc(columnTable.position),
        asc(columnTable.id),
      )
      .limit(RELATED_PAGE_SIZE);
    // One column per slug: the query is ordered by slug first, so the first
    // row for each is the one the page would have shown.
    const seen = new Set(projectColumns.map((column) => column.slug));
    for (const column of taskColumns) {
      if (seen.has(column.slug)) continue;
      seen.add(column.slug);
      projectColumns.push(column);
    }
  }

  const [columnCount] = await db
    .select({
      count: sql<number>`count(*)`,
      revision: revision(
        options.publicOnly,
        digest(
          [
            columnTable.id,
            columnTable.slug,
            columnTable.position,
            columnTable.name,
            columnTable.icon,
            columnTable.isFinal,
          ],
          columnTable.id,
        ),
      ),
    })
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId));

  let labelCount = 0;
  let linkCount = 0;
  let labelRevision = "0";
  let linkRevision = "0";
  if (taskIds.length) {
    const [labels] = await db
      .select({
        count: sql<number>`count(*)`,
        revision: revision(
          options.publicOnly,
          digest(
            [
              labelTable.id,
              labelTable.taskId,
              labelTable.name,
              labelTable.color,
            ],
            labelTable.id,
          ),
        ),
      })
      .from(labelTable)
      .where(inArray(labelTable.taskId, taskIds));
    const [links] = await db
      .select({
        count: sql<number>`count(*)`,
        revision: revision(
          options.publicOnly,
          digest(
            [
              externalLinkTable.id,
              externalLinkTable.taskId,
              externalLinkTable.updatedAt,
            ],
            externalLinkTable.id,
          ),
        ),
      })
      .from(externalLinkTable)
      .where(inArray(externalLinkTable.taskId, taskIds));
    labelCount = Number(labels?.count ?? 0);
    linkCount = Number(links?.count ?? 0);
    labelRevision = labels?.revision ?? "0";
    linkRevision = links?.revision ?? "0";
  }

  let publicRelatedRevision = "0";
  if (options.publicOnly) {
    // Every task page must detect edits to cards or metadata loaded earlier.
    const [labels] = await db
      .select({
        revision: digest(
          [labelTable.id, labelTable.taskId, labelTable.name, labelTable.color],
          labelTable.id,
        ),
      })
      .from(labelTable)
      .innerJoin(taskTable, eq(labelTable.taskId, taskTable.id))
      .where(whereClause);
    const [links] = await db
      .select({
        revision: digest(
          [externalLinkTable.id, externalLinkTable.updatedAt],
          externalLinkTable.id,
        ),
      })
      .from(externalLinkTable)
      .innerJoin(taskTable, eq(externalLinkTable.taskId, taskTable.id))
      .where(whereClause);
    const parent = alias(taskTable, "board_parent");
    const [children] = await db
      .select({
        revision: digest(
          [
            taskRelationTable.id,
            taskTable.id,
            // Completion belongs to the child's workflow, so a column change
            // that finishes a subtask has to show up here.
            sql<string>`case when ${taskIsCompleted} then '1' else '0' end`,
          ],
          taskRelationTable.id,
        ),
      })
      .from(taskRelationTable)
      .innerJoin(parent, eq(taskRelationTable.sourceTaskId, parent.id))
      .innerJoin(taskTable, eq(taskRelationTable.targetTaskId, taskTable.id))
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .where(
        and(
          eq(parent.projectId, projectId),
          eq(taskRelationTable.relationType, "subtask"),
          eq(projectTable.workspaceId, project.workspaceId),
          eq(projectTable.isPublic, true),
        ),
      );
    publicRelatedRevision = `${labels?.revision}:${links?.revision}:${children?.revision}`;
  }

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
    position: column.position,
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
      descriptionDeferred: project.descriptionDeferred,
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
      // changes whenever a card on an earlier page could have changed.
      ...(options.publicOnly
        ? {
            revision: `${project.revision}:${total}:${taskCount?.revision}:${columnCount?.count}:${columnCount?.revision}:${publicRelatedRevision}`,
            relatedRevision: `${labelCount}:${labelRevision}:${linkCount}:${linkRevision}`,
          }
        : {}),
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      relatedPage,
      relatedPageSize: RELATED_PAGE_SIZE,
      relatedTotalPages: Math.max(
        1,
        Math.ceil(
          Math.max(Number(columnCount?.count ?? 0), labelCount, linkCount) /
            RELATED_PAGE_SIZE,
        ),
      ),
    },
  };
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export default function getTasks(
  projectId: string,
  options: GetTasksOptions = {},
) {
  return boundedTaskRead(
    (db) => getTasksPage(db, projectId, options),
    "Task list request took too long; retry later",
    options.deadlineMs,
  );
}
