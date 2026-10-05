import { and, eq, ne, or, sql } from "drizzle-orm";
import type db from "../database";
import { projectTable } from "../database/schema";

export function isSameProjectKey(a: string, b: string) {
  return (
    a.normalize("NFKC").toLowerCase() === b.normalize("NFKC").toLowerCase()
  );
}

export function mayMatchProjectKey(key: string) {
  return or(
    sql`lower(${projectTable.slug}) = lower(${key.normalize("NFKC")})`,
    // A stored key whose byte length differs from its character length holds
    // multi-byte characters, which SQLite's lower() leaves alone; the caller
    // still has to compare those in JS.
    sql`length(CAST(${projectTable.slug} AS BLOB)) <> length(${projectTable.slug})`,
  );
}

export async function findProjectKeyConflict(
  database: Pick<typeof db, "select">,
  workspaceId: string,
  key: string,
  { excludeProjectId }: { excludeProjectId?: string } = {},
) {
  const projects = await database
    .select({ name: projectTable.name, slug: projectTable.slug })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        mayMatchProjectKey(key),
        excludeProjectId ? ne(projectTable.id, excludeProjectId) : undefined,
      ),
    );

  return projects.find((project) => isSameProjectKey(project.slug, key));
}

export function projectKeyTakenMessage(key: string, projectName: string) {
  return `This workspace already has a project using the key "${key}" (${projectName}). Choose a different key.`;
}
