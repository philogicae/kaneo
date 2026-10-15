import { sql } from "drizzle-orm";
import db from "./index";

/**
 * Cross-instance lease for a single-instance self-hosted deployment.
 *
 * Upstream relies on Postgres advisory locks, which libSQL does not provide.
 * The `job_lease` row plays the same role: a holder records its own token and
 * expiry, contenders refuse while the lease is live, and a crashed holder's
 * lease becomes reclaimable once `expires_at` passes. SQLite serialises
 * writers, so the insert/update below is atomic without a second lock.
 */
const DEFAULT_LEASE_MS = 30_000;

export async function withLease<T>(
  name: string,
  run: () => Promise<T>,
  options: { leaseMs?: number; busy: () => Error },
): Promise<T> {
  const owner = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
  const now = Date.now();
  const expiresAt = now + leaseMs;

  const claimed = await db.run(sql`
    INSERT INTO job_lease (name, owner, expires_at)
    VALUES (${name}, ${owner}, ${expiresAt})
    ON CONFLICT(name) DO UPDATE SET owner = ${owner}, expires_at = ${expiresAt}
    WHERE job_lease.expires_at <= ${now}
  `);

  if (!claimed.rowsAffected) {
    throw options.busy();
  }

  try {
    return await run();
  } finally {
    await db.run(sql`
      DELETE FROM job_lease WHERE name = ${name} AND owner = ${owner}
    `);
  }
}

/** Release leases whose holder never came back. Safe to call on a timer. */
export async function reapExpiredLeases(): Promise<void> {
  await db.run(sql`DELETE FROM job_lease WHERE expires_at <= ${Date.now()}`);
}
