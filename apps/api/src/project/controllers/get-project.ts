import { type AnyColumn, and, eq, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";

async function getProject(
  id: string,
  workspaceId: string,
  options: { tasksLimit?: number; tasksOffset?: number } = {},
) {
  const project = await db.query.projectTable.findFirst({
    where: and(
      eq(projectTable.id, id),
      eq(projectTable.workspaceId, workspaceId),
    ),
    with: {
      tasks: {
        // Types are explicit because TypeScript does not infer the callback
        // parameters of a nested relational orderBy; drizzle passes the
        // relation's table there, not the selected row.
        orderBy: (
          fields: { position: AnyColumn },
          operators: { asc: (column: AnyColumn) => SQL },
        ) => [operators.asc(fields.position)],
        // -1 keeps every task for callers that do not page (the web app);
        // MCP callers pass an explicit limit to bound the payload.
        limit: options.tasksLimit ?? -1,
        offset: options.tasksOffset ?? 0,
      },
    },
  });

  if (!project) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  return project;
}

export default getProject;
