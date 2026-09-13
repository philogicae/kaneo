import { and, eq } from "drizzle-orm";
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
        orderBy: (tasks, { asc }) => [asc(tasks.position)],
        // -1 keeps every task for callers that do not page (the web app);
        // MCP callers pass an explicit limit to bound the payload.
        limit: options.tasksLimit ?? -1,
        ...(options.tasksOffset !== undefined
          ? { offset: options.tasksOffset }
          : {}),
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
