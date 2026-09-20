import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import db from "../../database";
import {
  activityTable,
  appointmentTable,
  projectTable,
  taskTable,
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import { isJevEnabled } from "../../jev/client";
import { CANDIDATE_CAP } from "../../jev/rerank";
import {
  getExplicitProjectGrantIds,
  getFullAccessWorkspaceIds,
} from "../../utils/access-scope";
import { rerankSearchResults } from "../jev-search";
import { escapeLikePattern } from "../like-pattern";
import { TASK_SHORT_ID_PATTERN } from "../task-short-id";

type SearchParams = {
  query: string;
  userEmail?: string;
  userId?: string;
  type?:
    | "all"
    | "tasks"
    | "appointments"
    | "projects"
    | "workspaces"
    | "comments"
    | "activities";
  workspaceId?: string;
  projectId?: string;
  limit?: number;
};

type SearchResult = {
  id: string;
  type:
    | "task"
    | "appointment"
    | "project"
    | "workspace"
    | "comment"
    | "activity";
  title: string;
  description?: string;
  content?: string;
  projectId?: string;
  projectName?: string;
  workspaceId?: string;
  workspaceName?: string;
  userId?: string;
  userName?: string;
  createdAt: Date;
  relevanceScore: number;
  taskNumber?: number;
  projectSlug?: string;
  priority?: string;
  status?: string;
};

function toDisplayCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

// A multi-word query matches every token across the searched column.
const MAX_SEARCH_TOKENS = 6;
type LikeTarget = Parameters<typeof like>[0];

function getActivitySearchContent(
  type: string,
  content: string | null,
  eventData: unknown,
) {
  if (content) return content;
  if (!eventData || typeof eventData !== "object" || Array.isArray(eventData)) {
    return undefined;
  }

  const data = eventData as Record<string, unknown>;

  switch (type) {
    case "status_changed":
      return `changed status from ${toDisplayCase(String(data.oldStatus ?? ""))} to ${toDisplayCase(String(data.newStatus ?? ""))}`;
    case "priority_changed":
      return `changed priority from ${toDisplayCase(String(data.oldPriority ?? ""))} to ${toDisplayCase(String(data.newPriority ?? ""))}`;
    case "unassigned":
      return "unassigned the task";
    case "assignee_changed":
      return data.isSelfAssigned
        ? "assigned the task to themselves"
        : `assigned the task to ${String(data.newAssignee ?? "someone")}`;
    case "due_date_changed":
      if (!data.newDueDate) {
        return "cleared the due date";
      }
      if (!data.oldDueDate) {
        return `set due date to ${String(data.newDueDate)}`;
      }
      return `changed due date from ${String(data.oldDueDate)} to ${String(data.newDueDate)}`;
    case "title_changed":
      return `changed title from "${String(data.oldTitle ?? "")}" to "${String(data.newTitle ?? "")}"`;
    case "task":
      return "created the task";
    default:
      return undefined;
  }
}

async function globalSearch(params: SearchParams): Promise<{
  results: SearchResult[];
  totalCount: number;
  searchQuery: string;
}> {
  const {
    query,
    userId,
    userEmail,
    type = "all",
    workspaceId,
    projectId,
    limit = 20,
  } = params;

  let resolvedUserId = userId;
  if (!resolvedUserId && userEmail) {
    const user = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, userEmail))
      .limit(1);

    if (user.length > 0 && user[0]) {
      resolvedUserId = user[0].id;
    }
  }

  if (!resolvedUserId) {
    return { results: [], totalCount: 0, searchQuery: query };
  }

  const userWorkspaces = await db
    .select({ workspaceId: workspaceUserTable.workspaceId })
    .from(workspaceUserTable)
    .where(eq(workspaceUserTable.userId, resolvedUserId));

  const accessibleWorkspaceIds = userWorkspaces
    .map((w) => w.workspaceId)
    .filter(Boolean);

  if (accessibleWorkspaceIds.length === 0) {
    return { results: [], totalCount: 0, searchQuery: query };
  }

  const results: SearchResult[] = [];
  const searchPattern = `%${query.toLowerCase()}%`;
  // With Jev enabled the SQL pass over-fetches candidates that the reranker
  // then filters down to the requested limit.
  const fetchLimit = isJevEnabled() ? CANDIDATE_CAP : limit;
  // Multi-word queries match token-by-token (AND): a phrase-only LIKE misses
  // "redirect loop in login" for the query "login redirect". Tokens shorter
  // than 2 characters are dropped when longer ones exist, and the full query
  // still drives relevance ordering.
  const tokens = (() => {
    const parts = query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, MAX_SEARCH_TOKENS);
    const meaningful = parts.filter((token) => token.length >= 2);
    return meaningful.length > 0 ? meaningful : parts;
  })();
  const allTokensLike = (column: LikeTarget) =>
    tokens.length === 0
      ? like(column, searchPattern)
      : and(...tokens.map((token) => like(column, `%${token}%`)));

  // Project-level scope: the user sees every project of their full-access
  // workspaces, plus the projects explicitly granted through access teams or
  // direct grants. Scoped members therefore never match the rest of a shared
  // workspace.
  const [fullWorkspaceIds, explicitProjectIds] = await Promise.all([
    getFullAccessWorkspaceIds(resolvedUserId),
    getExplicitProjectGrantIds(resolvedUserId),
  ]);

  const accessConditions = [];
  if (fullWorkspaceIds.length > 0) {
    accessConditions.push(inArray(projectTable.workspaceId, fullWorkspaceIds));
  }
  if (explicitProjectIds.length > 0) {
    accessConditions.push(inArray(projectTable.id, explicitProjectIds));
  }
  if (accessConditions.length === 0) {
    return { results: [], totalCount: 0, searchQuery: query };
  }
  const projectAccessFilter = or(...accessConditions);

  // An explicit workspace id is always intersected with that project scope so
  // a foreign id can never widen the search; the middleware's optional mode no
  // longer guarantees that check upstream.
  const workspaceFilter = workspaceId
    ? and(
        projectAccessFilter,
        eq(projectTable.workspaceId, workspaceId),
        inArray(projectTable.workspaceId, accessibleWorkspaceIds),
      )
    : and(
        projectAccessFilter,
        inArray(projectTable.workspaceId, accessibleWorkspaceIds),
      );

  // Check if query matches short-id pattern (e.g. "DEP-23"). `generateProjectSlug`
  // normalizes to NFKC before it stores a key, so the query is normalized too,
  // or a decomposed "ПА-23" would never reach the stored composed form.
  const shortIdMatch = query.normalize("NFKC").match(TASK_SHORT_ID_PATTERN);

  if (type === "all" || type === "tasks") {
    const seenTaskIds = new Set<string>();

    // If query matches short-id pattern, look up by project slug + task number first
    if (shortIdMatch?.[1] && shortIdMatch[2]) {
      const slug = shortIdMatch[1];
      const numberStr = shortIdMatch[2];
      const taskNumber = Number.parseInt(numberStr, 10);

      const shortIdTasks = await db
        .select({
          id: taskTable.id,
          title: taskTable.title,
          description: taskTable.description,
          projectId: taskTable.projectId,
          projectName: projectTable.name,
          projectSlug: projectTable.slug,
          workspaceId: projectTable.workspaceId,
          workspaceName: workspaceTable.name,
          userId: taskTable.userId,
          userName: userTable.name,
          createdAt: taskTable.createdAt,
          taskNumber: taskTable.number,
          priority: taskTable.priority,
          status: taskTable.status,
        })
        .from(taskTable)
        .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .leftJoin(
          workspaceTable,
          eq(projectTable.workspaceId, workspaceTable.id),
        )
        .leftJoin(userTable, eq(taskTable.userId, userTable.id))
        .where(
          and(
            workspaceFilter,
            projectId ? eq(taskTable.projectId, projectId) : undefined,
            // A project key may hold `_`, which `LIKE` reads as "any one
            // character", so `DE_-23` would also match a task in `DEP` and the
            // `limit(1)` below would pick whichever came back first. Escaping
            // plus an explicit ESCAPE clause keeps the case-insensitive
            // comparison and drops the wildcards (SQLite has no default escape
            // character, unlike Postgres).
            sql`${projectTable.slug} LIKE ${escapeLikePattern(slug)} ESCAPE '\\'`,
            eq(taskTable.number, taskNumber),
          ),
        )
        .limit(1);

      for (const task of shortIdTasks) {
        seenTaskIds.add(task.id);
        results.push({
          id: task.id,
          type: "task",
          title: task.title,
          description: task.description || undefined,
          projectId: task.projectId,
          projectName: task.projectName || undefined,
          projectSlug: task.projectSlug || undefined,
          workspaceId: task.workspaceId || undefined,
          workspaceName: task.workspaceName || undefined,
          userId: task.userId || undefined,
          userName: task.userName || undefined,
          createdAt: task.createdAt,
          relevanceScore: 10, // Highest relevance for exact short-id match
          taskNumber: task.taskNumber || undefined,
          priority: task.priority || undefined,
          status: task.status,
        });
      }
    }

    // Also run text search for tasks
    const taskRelevanceScore = sql<number>`
      CASE
        WHEN LOWER(${taskTable.title}) LIKE ${searchPattern} THEN 3
        WHEN LOWER(${taskTable.description}) LIKE ${searchPattern} THEN 2
        ELSE 1
      END
    `;

    const taskQuery = db
      .select({
        id: taskTable.id,
        title: taskTable.title,
        description: taskTable.description,
        projectId: taskTable.projectId,
        projectName: projectTable.name,
        projectSlug: projectTable.slug,
        workspaceId: projectTable.workspaceId,
        workspaceName: workspaceTable.name,
        userId: taskTable.userId,
        userName: userTable.name,
        createdAt: taskTable.createdAt,
        taskNumber: taskTable.number,
        priority: taskTable.priority,
        status: taskTable.status,
        relevanceScore: taskRelevanceScore.as("relevanceScore"),
      })
      .from(taskTable)
      .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
      .leftJoin(userTable, eq(taskTable.userId, userTable.id))
      .where(
        and(
          workspaceFilter,
          projectId ? eq(taskTable.projectId, projectId) : undefined,
          or(
            allTokensLike(taskTable.title),
            allTokensLike(taskTable.description),
          ),
        ),
      )
      .orderBy(desc(taskRelevanceScore), desc(taskTable.createdAt))
      .limit(fetchLimit);

    const tasks = await taskQuery;

    for (const task of tasks) {
      if (seenTaskIds.has(task.id)) continue;
      results.push({
        id: task.id,
        type: "task",
        title: task.title,
        description: task.description || undefined,
        projectId: task.projectId,
        projectName: task.projectName || undefined,
        projectSlug: task.projectSlug || undefined,
        workspaceId: task.workspaceId || undefined,
        workspaceName: task.workspaceName || undefined,
        userId: task.userId || undefined,
        userName: task.userName || undefined,
        createdAt: task.createdAt,
        relevanceScore: task.relevanceScore,
        taskNumber: task.taskNumber || undefined,
        priority: task.priority || undefined,
        status: task.status,
      });
    }
  }

  if (type === "all" || type === "appointments") {
    const appointmentRelevanceScore = sql<number>`
      CASE
        WHEN LOWER(${appointmentTable.title}) LIKE ${searchPattern} THEN 3
        WHEN LOWER(${appointmentTable.description}) LIKE ${searchPattern} THEN 2
        ELSE 1
      END
    `;

    const appointments = await db
      .select({
        id: appointmentTable.id,
        title: appointmentTable.title,
        description: appointmentTable.description,
        projectId: appointmentTable.projectId,
        projectName: projectTable.name,
        projectSlug: projectTable.slug,
        workspaceId: projectTable.workspaceId,
        workspaceName: workspaceTable.name,
        userId: appointmentTable.userId,
        userName: userTable.name,
        createdAt: appointmentTable.createdAt,
        priority: appointmentTable.priority,
        relevanceScore: appointmentRelevanceScore.as("relevanceScore"),
      })
      .from(appointmentTable)
      .leftJoin(projectTable, eq(appointmentTable.projectId, projectTable.id))
      .leftJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
      .leftJoin(userTable, eq(appointmentTable.userId, userTable.id))
      .where(
        and(
          workspaceFilter,
          projectId ? eq(appointmentTable.projectId, projectId) : undefined,
          or(
            allTokensLike(appointmentTable.title),
            allTokensLike(appointmentTable.description),
          ),
        ),
      )
      .orderBy(
        desc(appointmentRelevanceScore),
        desc(appointmentTable.createdAt),
      )
      .limit(fetchLimit);

    for (const appointment of appointments) {
      results.push({
        id: appointment.id,
        type: "appointment",
        title: appointment.title,
        description: appointment.description || undefined,
        projectId: appointment.projectId,
        projectName: appointment.projectName || undefined,
        projectSlug: appointment.projectSlug || undefined,
        workspaceId: appointment.workspaceId || undefined,
        workspaceName: appointment.workspaceName || undefined,
        userId: appointment.userId || undefined,
        userName: appointment.userName || undefined,
        createdAt: appointment.createdAt,
        relevanceScore: appointment.relevanceScore,
        priority: appointment.priority || undefined,
      });
    }
  }

  if (type === "all" || type === "projects") {
    const projectRelevanceScore = sql<number>`
      CASE
        WHEN LOWER(${projectTable.name}) LIKE ${searchPattern} THEN 3
        WHEN LOWER(${projectTable.description}) LIKE ${searchPattern} THEN 2
        ELSE 1
      END
    `;

    const projectQuery = db
      .select({
        id: projectTable.id,
        name: projectTable.name,
        description: projectTable.description,
        slug: projectTable.slug,
        workspaceId: projectTable.workspaceId,
        workspaceName: workspaceTable.name,
        createdAt: projectTable.createdAt,
        relevanceScore: projectRelevanceScore.as("relevanceScore"),
      })
      .from(projectTable)
      .leftJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
      .where(
        and(
          workspaceFilter,
          or(
            allTokensLike(projectTable.name),
            allTokensLike(projectTable.description),
          ),
        ),
      )
      .orderBy(desc(projectRelevanceScore), desc(projectTable.createdAt))
      .limit(fetchLimit);

    const projects = await projectQuery;

    for (const project of projects) {
      results.push({
        id: project.id,
        type: "project",
        title: project.name,
        description: project.description || undefined,
        projectId: project.id,
        projectSlug: project.slug || undefined,
        workspaceId: project.workspaceId,
        workspaceName: project.workspaceName || undefined,
        createdAt: project.createdAt,
        relevanceScore: project.relevanceScore,
      });
    }
  }

  if (type === "all" || type === "workspaces") {
    const workspaceRelevanceScore = sql<number>`
      CASE
        WHEN LOWER(${workspaceTable.name}) LIKE ${searchPattern} THEN 3
        WHEN LOWER(${workspaceTable.description}) LIKE ${searchPattern} THEN 2
        ELSE 1
      END
    `;

    const workspaceQuery = db
      .select({
        id: workspaceTable.id,
        name: workspaceTable.name,
        description: workspaceTable.description,
        createdAt: workspaceTable.createdAt,
        relevanceScore: workspaceRelevanceScore.as("relevanceScore"),
      })
      .from(workspaceTable)
      .leftJoin(
        workspaceUserTable,
        eq(workspaceTable.id, workspaceUserTable.workspaceId),
      )
      .where(
        and(
          inArray(workspaceTable.id, accessibleWorkspaceIds),
          or(
            allTokensLike(workspaceTable.name),
            allTokensLike(workspaceTable.description),
          ),
        ),
      )
      .orderBy(desc(workspaceRelevanceScore), desc(workspaceTable.createdAt))
      .limit(fetchLimit);

    const workspaces = await workspaceQuery;

    for (const workspace of workspaces) {
      results.push({
        id: workspace.id,
        type: "workspace",
        title: workspace.name,
        description: workspace.description || undefined,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        createdAt: workspace.createdAt,
        relevanceScore: workspace.relevanceScore,
      });
    }
  }

  if (type === "all" || type === "comments" || type === "activities") {
    const searchableActivityText = sql<string>`COALESCE(${activityTable.content}, CAST(${activityTable.eventData} AS text), '')`;
    const activityRelevanceScore = sql<number>`
      CASE
        WHEN LOWER(${searchableActivityText}) LIKE ${searchPattern} THEN 2
        WHEN LOWER(${taskTable.title}) LIKE ${searchPattern} THEN 1
        ELSE 1
      END
    `;

    const activityQuery = db
      .select({
        id: activityTable.id,
        type: activityTable.type,
        content: activityTable.content,
        eventData: activityTable.eventData,
        taskId: activityTable.taskId,
        taskTitle: taskTable.title,
        taskNumber: taskTable.number,
        projectId: projectTable.id,
        projectName: projectTable.name,
        projectSlug: projectTable.slug,
        workspaceId: projectTable.workspaceId,
        workspaceName: workspaceTable.name,
        userId: activityTable.userId,
        userName: userTable.name,
        createdAt: activityTable.createdAt,
        relevanceScore: activityRelevanceScore.as("relevanceScore"),
      })
      .from(activityTable)
      .leftJoin(taskTable, eq(activityTable.taskId, taskTable.id))
      .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
      .leftJoin(userTable, eq(activityTable.userId, userTable.id))
      .where(
        and(
          workspaceFilter,
          projectId ? eq(taskTable.projectId, projectId) : undefined,
          or(
            allTokensLike(searchableActivityText),
            allTokensLike(taskTable.title),
          ),
          type === "comments" ? eq(activityTable.type, "comment") : undefined,
        ),
      )
      .orderBy(desc(activityRelevanceScore), desc(activityTable.createdAt))
      .limit(fetchLimit);

    const activities = await activityQuery;

    for (const activity of activities) {
      const isComment = activity.type === "comment";
      const activityContent = getActivitySearchContent(
        activity.type,
        activity.content,
        activity.eventData,
      );
      results.push({
        id: activity.id,
        type: isComment ? "comment" : "activity",
        title: isComment
          ? `Comment on ${activity.taskTitle || "task"}`
          : `${activity.type} on ${activity.taskTitle || "task"}`,
        content: activityContent,
        projectId: activity.projectId || undefined,
        projectName: activity.projectName || undefined,
        projectSlug: activity.projectSlug || undefined,
        workspaceId: activity.workspaceId || undefined,
        workspaceName: activity.workspaceName || undefined,
        userId: activity.userId || undefined,
        userName: activity.userName || undefined,
        createdAt: activity.createdAt,
        relevanceScore: activity.relevanceScore,
        taskNumber: activity.taskNumber || undefined,
      });
    }
  }

  results.sort((a, b) => {
    if (a.relevanceScore !== b.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const { results: finalResults, totalCount } = await rerankSearchResults(
    results,
    query,
    limit,
  );

  return {
    results: finalResults,
    totalCount,
    searchQuery: query,
  };
}

export default globalSearch;
