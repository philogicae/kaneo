import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import {
  getDirectWorkspaceGrants,
  replaceDirectWorkspaceGrants,
} from "../../utils/access-grants";

type UpdateMemberAccessInput = {
  allProjects: boolean;
  projectIds?: string[];
};

async function updateMemberAccess(
  workspaceId: string,
  userId: string,
  input: UpdateMemberAccessInput,
  grantedBy: string,
) {
  const [membership] = await db
    .select({ id: schema.workspaceUserTable.id })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new HTTPException(404, { message: "Unknown workspace member" });
  }

  const projectIds = [...new Set(input.projectIds ?? [])];
  if (!input.allProjects && projectIds.length > 0) {
    const rows = await db
      .select({ id: schema.projectTable.id })
      .from(schema.projectTable)
      .where(
        and(
          eq(schema.projectTable.workspaceId, workspaceId),
          inArray(schema.projectTable.id, projectIds),
        ),
      );
    if (rows.length !== projectIds.length) {
      throw new HTTPException(400, {
        message: "Unknown project in this workspace",
      });
    }
  }

  await replaceDirectWorkspaceGrants(
    userId,
    workspaceId,
    { allProjects: input.allProjects, projectIds },
    { grantedBy },
  );

  // Clearing the last grant can remove the membership; report "none" then.
  const [updated] = await db
    .select({ accessScope: schema.workspaceUserTable.accessScope })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    )
    .limit(1);

  return {
    accessScope: updated?.accessScope ?? "none",
    ...(await getDirectWorkspaceGrants(userId, workspaceId)),
  };
}

export default updateMemberAccess;
