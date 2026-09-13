import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import db, { applyDatabasePragmas } from "../../../apps/api/src/database";
import { resolveDatabaseConfig } from "../../../apps/api/src/database/resolve-database-config";

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDir, "../../../apps/api/drizzle");

let migrationPromise: Promise<void> | null = null;

function assertTestDatabasePath() {
  const { path, isMemory } = resolveDatabaseConfig();

  if (isMemory) {
    return;
  }

  if (!/_test(\.\w+)?$/i.test(path)) {
    throw new Error(
      `Refusing to manage non-test database "${path}". DATABASE_PATH must point to a test database.`,
    );
  }
}

export async function ensureTestDatabaseMigrated() {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      assertTestDatabasePath();
      await applyDatabasePragmas();
      await migrate(db, {
        migrationsFolder,
      });
    })();
  }

  try {
    await migrationPromise;
  } catch (error) {
    migrationPromise = null;
    throw error;
  }
}

// The SQLite catalog is the canonical source of what tables actually exist
// after migrations run. `__drizzle_migrations` is excluded so a reset does not
// lose the applied-migration journal.
async function listTableNames(): Promise<string[]> {
  const rows = await db.all<{ name: string }>(sql`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name <> '__drizzle_migrations'
    ORDER BY name
  `);

  return rows.map((row) => row.name);
}

export async function resetTestDatabase() {
  await ensureTestDatabaseMigrated();

  const tableNames = await listTableNames();

  if (tableNames.length === 0) {
    throw new Error(
      "resetTestDatabase found no tables to clear. Did migrations run?",
    );
  }

  // SQLite has no TRUNCATE, and FK checks must be off while clearing parents.
  await db.run(sql`PRAGMA foreign_keys = OFF`);
  try {
    for (const tableName of tableNames) {
      await db.run(sql`DELETE FROM ${sql.identifier(tableName)}`);
    }
  } finally {
    await db.run(sql`PRAGMA foreign_keys = ON`);
  }
}
