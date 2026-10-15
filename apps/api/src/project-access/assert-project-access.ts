import { HTTPException } from "hono/http-exception";
import { findInaccessibleProjectIds } from "./find-inaccessible-project-ids";

export async function assertProjectAccess(
  userId: string,
  projectIds: string | readonly string[],
  database?: Parameters<typeof findInaccessibleProjectIds>[2],
): Promise<void> {
  const ids = typeof projectIds === "string" ? [projectIds] : projectIds;
  const denied = await findInaccessibleProjectIds(userId, ids, database);
  if (denied.length > 0) {
    throw new HTTPException(403, {
      message: "You don't have access to this project",
    });
  }
}
