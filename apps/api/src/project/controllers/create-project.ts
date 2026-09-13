import { eq, max } from "drizzle-orm";
import db from "../../database";
import { columnTable, projectTable } from "../../database/schema";

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
) {
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
      }

      return createdProject;
    },
    { behavior: "immediate" },
  );
}

export default createProject;
