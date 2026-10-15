import { sql } from "drizzle-orm";
import db from "../database";

/**
 * Builds published before the migration-renumbering fix recorded the
 * renumbered 0008-0011 migrations with upstream's original timestamps, which
 * are earlier than 0007's. The fixed journal only applies entries newer than
 * the last recorded one, so a database created fresh on such a build keeps
 * those rows but is older than the fixed entries: the migrator would re-run
 * them and abort on `table ... already exists`.
 *
 * Move the recorded timestamps to the fixed values once. Databases that never
 * saw the broken ordering (or were already repaired) match nothing.
 */
const RENUMBERED_TIMESTAMPS: ReadonlyArray<readonly [number, number]> = [
  [1791234516735, 1791946401000],
  [1791391236556, 1791946402000],
  [1791580417885, 1791946403000],
  [1791727180448, 1791946404000],
];

export async function repairRenumberedMigrationTimestamps(): Promise<void> {
  for (const [recorded, fixed] of RENUMBERED_TIMESTAMPS) {
    await db.run(
      sql`update __drizzle_migrations
          set created_at = ${fixed}
          where created_at = ${recorded}`,
    );
  }
}
