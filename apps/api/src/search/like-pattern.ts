import { type SQLWrapper, sql } from "drizzle-orm";

// `_` and `%` are wildcards to LIKE and ILIKE, and `\` is the escape character
// Postgres uses when no ESCAPE clause is given. A value compared with a
// case-insensitive match has to go through here first, or a key holding one of
// them matches more rows than the one that was asked for.
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/**
 * Case-insensitive `LIKE` for a caller-supplied pattern.
 *
 * SQLite has no `ILIKE`, and drizzle's SQLite dialect emits the operator
 * verbatim, which is a syntax error there. Lowercasing both sides is the
 * portable equivalent, and the explicit `ESCAPE` is needed because SQLite,
 * unlike Postgres, gives `LIKE` no default escape character.
 */
export function caseInsensitiveLike(
  column: SQLWrapper,
  pattern: string,
): SQLWrapper {
  return sql`lower(${column}) like ${pattern.toLowerCase()} escape '\\'`;
}
