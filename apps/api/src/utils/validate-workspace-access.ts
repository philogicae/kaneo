import { and, eq, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import { getWorkspaceAccessLevel } from "./access-scope";

export async function validateWorkspaceAccess(
  userId: string,
  workspaceId: string,
  apiKeyId?: string,
): Promise<void> {
  if (apiKeyId) {
    const apiKey = await db
      .select()
      .from(schema.apikeyTable)
      .where(
        and(
          eq(schema.apikeyTable.id, apiKeyId),
          or(
            eq(schema.apikeyTable.referenceId, userId),
            eq(schema.apikeyTable.userId, userId),
          ),
          eq(schema.apikeyTable.enabled, true),
        ),
      )
      .limit(1);

    if (apiKey.length === 0) {
      throw new HTTPException(403, {
        message: "Invalid API key for this workspace",
      });
    }
  }

  // Instance admins bypass, full members reach everything, scoped members and
  // team/grant-only users still open the workspace for their granted projects.
  const level = await getWorkspaceAccessLevel(userId, workspaceId);
  if (level === "none") {
    throw new HTTPException(403, {
      message: "You don't have access to this workspace",
    });
  }
}
