import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { getDirectWorkspaceGrants } from "../../utils/access-grants";

async function getMemberAccess(workspaceId: string, userId: string) {
  const [membership] = await db
    .select({ accessScope: schema.workspaceUserTable.accessScope })
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

  return {
    accessScope: membership.accessScope,
    ...(await getDirectWorkspaceGrants(userId, workspaceId)),
  };
}

export default getMemberAccess;
