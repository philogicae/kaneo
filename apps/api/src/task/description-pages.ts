import { and, asc, eq, gt, sql, type SQLWrapper } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { projectTable, taskTable } from "../database/schema";
import { boundedTaskRead } from "./bounded-read";

export const BOARD_DESCRIPTION_MAX_BYTES = 64 * 1024;
export const DESCRIPTION_CHUNK_CHARACTERS = 32 * 1024;
export const DESCRIPTION_MATCH_PAGE_SIZE = 100;

/** SQLite's `length()` counts characters; the bound is on UTF-8 bytes. */
const byteLength = (column: SQLWrapper) =>
  sql<number>`length(cast(${column} as blob))`;

// SQLite has no boolean type: a comparison or `true` keyword yields 0/1, which
// would serialise as a number. mapWith coerces back to a boolean.
export const projectDescriptionDeferred =
  sql<boolean>`case when ${byteLength(projectTable.description)} > ${BOARD_DESCRIPTION_MAX_BYTES} then 1 else 0 end`.mapWith(
    Boolean,
  );
export const boardProjectDescription = sql<
  string | null
>`case when ${byteLength(projectTable.description)} > ${BOARD_DESCRIPTION_MAX_BYTES} then null else ${projectTable.description} end`;
export const descriptionDeferred =
  sql<boolean>`case when ${byteLength(taskTable.description)} > ${BOARD_DESCRIPTION_MAX_BYTES} then 1 else 0 end`.mapWith(
    Boolean,
  );
export const boardDescription = sql<
  string | null
>`case when ${descriptionDeferred} then null else ${taskTable.description} end`;

// Postgres exposed `xmin` as the row's revision string, which is what the
// paging endpoints hand back as `version`. libSQL has no row version, so the
// version is the SHA3 of the exact text being paged: a revision check then
// means "this is still the same document", which is what stale-page detection
// actually needs, and it changes only when the text does.
const taskDescriptionVersion = sql<string>`lower(hex(sha3(coalesce(${taskTable.description}, ''), 256)))`;
const projectDescriptionVersion = sql<string>`lower(hex(sha3(coalesce(${projectTable.description}, ''), 256)))`;

// SQLite's substr() counts Unicode characters, matching the character-based
// offsets Postgres' substring() took.
const taskDescriptionChunk = (offset: number) =>
  sql<string>`coalesce(substr(${taskTable.description}, ${offset + 1}, ${DESCRIPTION_CHUNK_CHARACTERS + 1}), '')`;
const projectDescriptionChunk = (offset: number) =>
  sql<string>`coalesce(substr(${projectTable.description}, ${offset + 1}, ${DESCRIPTION_CHUNK_CHARACTERS + 1}), '')`;

function page(content: string, version: string, offset: number) {
  // The query reads one character past the chunk to learn whether more remain.
  const characters = Array.from(content);
  return {
    content: characters.slice(0, DESCRIPTION_CHUNK_CHARACTERS).join(""),
    version,
    nextOffset:
      characters.length > DESCRIPTION_CHUNK_CHARACTERS
        ? offset + DESCRIPTION_CHUNK_CHARACTERS
        : null,
  };
}

export async function getDescriptionPage(
  taskId: string,
  options: {
    offset: number;
    version?: string;
    publicProjectId?: string;
    deadlineMs?: number;
  },
) {
  return boundedTaskRead(
    async (tx) => {
      const conditions = [eq(taskTable.id, taskId)];
      if (options.publicProjectId)
        conditions.push(
          eq(taskTable.projectId, options.publicProjectId),
          eq(projectTable.isPublic, true),
        );
      if (options.version)
        conditions.push(sql`${taskDescriptionVersion} = ${options.version}`);
      const [row] = await tx
        .select({
          content: taskDescriptionChunk(options.offset),
          version: taskDescriptionVersion,
        })
        .from(taskTable)
        .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
        .where(and(...conditions))
        .limit(1);
      if (!row)
        throw new HTTPException(options.version ? 409 : 404, {
          message:
            "Description changed or is unavailable; refresh before loading it again",
        });
      return page(row.content, row.version, options.offset);
    },
    "Description request took too long; retry later",
    options.deadlineMs,
  );
}

export async function getDeferredDescriptionMatches(
  projectId: string,
  query: string,
  after?: string,
) {
  return boundedTaskRead(async (tx) => {
    const rows = await tx
      .select({ id: taskTable.id })
      .from(taskTable)
      .where(
        and(
          eq(taskTable.projectId, projectId),
          descriptionDeferred,
          // instr() is the literal-position search Postgres' strpos() gave;
          // a value holding % or _ stays a literal this way.
          sql`instr(lower(${taskTable.description}), lower(${query})) > 0`,
          after ? gt(taskTable.id, after) : undefined,
        ),
      )
      .orderBy(asc(taskTable.id))
      .limit(DESCRIPTION_MATCH_PAGE_SIZE + 1);
    const matches = rows.slice(0, DESCRIPTION_MATCH_PAGE_SIZE);
    return {
      ids: matches.map((row) => row.id),
      nextCursor:
        rows.length > DESCRIPTION_MATCH_PAGE_SIZE
          ? (matches.at(-1)?.id ?? null)
          : null,
    };
  });
}

export async function getPublicProjectDescriptionPage(
  projectId: string,
  options: { offset: number; version?: string },
) {
  return boundedTaskRead(async (tx) => {
    const [row] = await tx
      .select({
        content: projectDescriptionChunk(options.offset),
        version: projectDescriptionVersion,
      })
      .from(projectTable)
      .where(
        and(
          eq(projectTable.id, projectId),
          eq(projectTable.isPublic, true),
          options.version
            ? sql`${projectDescriptionVersion} = ${options.version}`
            : undefined,
        ),
      )
      .limit(1);
    if (!row)
      throw new HTTPException(options.version ? 409 : 404, {
        message:
          "Description changed or is unavailable; refresh before loading it again",
      });
    return page(row.content, row.version, options.offset);
  });
}
