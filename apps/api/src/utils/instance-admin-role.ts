import { type AnyColumn, sql } from "drizzle-orm";

export function hasInstanceAdminRole(role: unknown) {
  return typeof role === "string" && role.split(",").includes("admin");
}

/**
 * Match the instance-admin role inside the comma-separated `role` column.
 *
 * Uses SQLite string functions rather than Postgres `string_to_array`/`ANY`:
 * the value is a single delimited list, so an exact match, a leading entry, or
 * a `,`-delimited entry all have to count.
 */
export function instanceAdminRoleSql(column: AnyColumn) {
  return sql`(
    ${column} = 'admin'
    OR ${column} LIKE 'admin,%'
    OR ${column} LIKE '%,admin'
    OR ${column} LIKE '%,admin,%'
  )`;
}
