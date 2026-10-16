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
    // Tasks are embedded only when the caller asks for them, so the default
    // detail read stays a project payload rather than every task on its board.
    // MCP callers pass an explicit limit to bound it.
    ...(options.tasksLimit === undefined
      ? {}
      : {
          with: {
            tasks: {
              // Types are explicit because TypeScript does not infer the
              // callback parameters of a nested relational orderBy; drizzle
              // passes the relation's table there, not the selected row.
              orderBy: (
                fields: { position: AnyColumn },
                operators: { asc: (column: AnyColumn) => SQL },
              ) => [operators.asc(fields.position)],
              limit: options.tasksLimit,
              offset: options.tasksOffset ?? 0,
            },
          },
        }),
  });

  if (!project) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  return project;
}

export default getProject;
