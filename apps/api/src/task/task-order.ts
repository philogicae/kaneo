import { asc, desc, type SQL, type SQLWrapper, sql } from "drizzle-orm";
import { taskTable } from "../database/schema";

export type TaskSortField =
  | "createdAt"
  | "priority"
  | "dueDate"
  | "position"
  | "title"
  | "number";

// Priority is stored as a slug; the CASE maps it to a sortable rank so
// "urgent" orders above "high" regardless of alphabetical order.
export const priorityCaseExpr = sql<number>`CASE
  WHEN ${taskTable.priority} = 'urgent' THEN 4
  WHEN ${taskTable.priority} = 'high' THEN 3
  WHEN ${taskTable.priority} = 'medium' THEN 2
  WHEN ${taskTable.priority} = 'low' THEN 1
  ELSE 0
END`;

export function buildTaskOrderBy(
  sortBy: TaskSortField | undefined,
  sortOrder: "asc" | "desc" | undefined,
): SQL {
  const direction = sortOrder === "desc" ? desc : asc;
  return direction(sortValue(sortBy));
}

/** The column a sort field orders by, for revisions that must track the sort. */
export function sortValue(sortBy: TaskSortField | undefined): SQLWrapper {
  switch (sortBy) {
    case "createdAt":
      return taskTable.createdAt;
    case "priority":
      return priorityCaseExpr;
    case "dueDate":
      return taskTable.dueDate;
    case "title":
      return taskTable.title;
    case "number":
      return taskTable.number;
    default:
      return taskTable.position;
  }
}
