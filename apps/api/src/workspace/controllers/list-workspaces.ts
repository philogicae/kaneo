import { and, eq, sql } from "drizzle-orm";
import db from "../../database";
import {
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import { workspaceAccessColumns } from "../can-read-workspace";
import { filterReadableWorkspaces } from "../filter-readable-workspaces";
import {
  toWorkspaceResponse,
  workspaceColumns,
} from "../to-workspace-response";

async function listWorkspaces(userId: string) {
  const sortName = sql`lower(${workspaceTable.name})`;

  // SQLite has no DISTINCT ON; keep the first row per workspace in this order.
  const rows = await db
    .select({
      ...workspaceColumns,
      ...workspaceAccessColumns,
    })
    .from(workspaceTable)
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, workspaceTable.id),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
    .orderBy(
      sortName,
      workspaceTable.id,
      workspaceUserTable.joinedAt,
      workspaceUserTable.id,
    );

  const seen = new Set<string>();
  const distinct = rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });

  return (await filterReadableWorkspaces(distinct)).map(toWorkspaceResponse);
}

export default listWorkspaces;
