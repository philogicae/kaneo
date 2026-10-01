import { HTTPException } from "hono/http-exception";
import { canAccessProject } from "./access-scope";

const NOT_ASSIGNABLE = "Assignee does not have access to this project";

// Project access is the assignability rule: a scoped member can only be given
// work in the projects they can open, so no orphan assignment or notification
// can point at a project they are refused on.
export async function filterAssignableUsers(
  userIds: string[],
  projectId: string,
): Promise<Set<string>> {
  if (userIds.length === 0) {
    return new Set();
  }

  const assignable = new Set<string>();
  for (const userId of userIds) {
    if (await canAccessProject(userId, projectId)) {
      assignable.add(userId);
    }
  }

  return assignable;
}

export async function assertAssignableUser(
  userId: string,
  projectId: string,
): Promise<void> {
  const assignable = await filterAssignableUsers([userId], projectId);

  if (!assignable.has(userId)) {
    throw new HTTPException(403, { message: NOT_ASSIGNABLE });
  }
}
