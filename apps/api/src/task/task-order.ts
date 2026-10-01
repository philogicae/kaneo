import { asc, desc, type SQL, sql } from "drizzle-orm";
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

  switch (sortBy) {
    case "createdAt":
      return direction(taskTable.createdAt);
    case "priority":
      return direction(priorityCaseExpr);
    case "dueDate":
      return direction(taskTable.dueDate);
    case "title":
      return direction(taskTable.title);
    case "number":
      return direction(taskTable.number);
    default:
      return direction(taskTable.position);
  }
}
