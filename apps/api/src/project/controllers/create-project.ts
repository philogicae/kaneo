import { eq, max } from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  projectTable,
  userProjectAccessTable,
} from "../../database/schema";
import { getWorkspaceAccessLevel } from "../../utils/access-scope";

export const DEFAULT_PROJECT_COLUMNS = [
  { name: "To Do", slug: "to-do", position: 0, isFinal: false },
  { name: "In Progress", slug: "in-progress", position: 1, isFinal: false },
  { name: "In Review", slug: "in-review", position: 2, isFinal: false },
  { name: "Done", slug: "done", position: 3, isFinal: true },
] as const;

async function createProject(
  workspaceId: string,
  name: string,
  icon: string,
  slug: string,
  description: string | null,
  userId?: string,
) {
  // A scoped member may create a project (the member role carries
  // project:create), but a fresh project has no grant and would fall outside
  // their own scope, hidden from its creator. Grant it to them directly.
  const creatorNeedsGrant =
    userId !== undefined &&
    (await getWorkspaceAccessLevel(userId, workspaceId)) === "scoped";

  return db.transaction(
    async (tx) => {
      // Serialize ordering writes per workspace: SQLite has a single writer,
      // and the immediate transaction prevents a concurrent create from
      // reading the same max(position) or interleaving with a reorder.
      // New projects go to the bottom of the workspace's ordering.
      const [{ maxPosition } = { maxPosition: null }] = await tx
        .select({ maxPosition: max(projectTable.position) })
        .from(projectTable)
        .where(eq(projectTable.workspaceId, workspaceId));

      const [createdProject] = await tx
        .insert(projectTable)
        .values({
          workspaceId,
          name,
          icon,
          slug,
          description,
          position: maxPosition === null ? 0 : maxPosition + 1,
        })
        .returning();

      if (createdProject) {
        for (const col of DEFAULT_PROJECT_COLUMNS) {
          await tx.insert(columnTable).values({
            projectId: createdProject.id,
            name: col.name,
            slug: col.slug,
            position: col.position,
            isFinal: col.isFinal,
          });
        }

        if (creatorNeedsGrant && userId) {
          await tx
            .insert(userProjectAccessTable)
            .values({ projectId: createdProject.id, userId });
        }
      }

      return createdProject;
    },
    { behavior: "immediate" },
  );
}

export default createProject;
