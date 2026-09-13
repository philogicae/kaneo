import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import db from "../database";
import { jobLeaseTable } from "../database/schema";

const INSTANCE_ID = randomUUID();

export const SEAT_RECONCILIATION_LEASE = "seat-reconciliation";

const DEFAULT_LEASE_MS = 15 * 60 * 1000;

export async function withJobLease<T>(
  name: string,
  run: () => Promise<T>,
  whenHeldElsewhere: () => T,
  leaseMs: number = DEFAULT_LEASE_MS,
): Promise<T> {
  const expiresAt = new Date(Date.now() + leaseMs);

  // Claim the lease in a short immediate transaction (SQLite serializes
  // writers, so exactly one instance can hold it). Claiming is kept separate
  // from the job itself so a long-running job never holds the write lock.
  const claimed = await db.transaction(
    async (tx) => {
      const [existing] = await tx
        .select()
        .from(jobLeaseTable)
        .where(eq(jobLeaseTable.name, name));

      if (existing && existing.expiresAt.getTime() >= Date.now()) {
        return false;
      }

      if (existing) {
        await tx
          .update(jobLeaseTable)
          .set({ owner: INSTANCE_ID, expiresAt })
          .where(eq(jobLeaseTable.name, name));
      } else {
        await tx.insert(jobLeaseTable).values({
          name,
          owner: INSTANCE_ID,
          expiresAt,
        });
      }

      return true;
    },
    { behavior: "immediate" },
  );

  if (!claimed) {
    return whenHeldElsewhere();
  }

  try {
    return await run();
  } finally {
    await db
      .delete(jobLeaseTable)
      .where(
        and(eq(jobLeaseTable.name, name), eq(jobLeaseTable.owner, INSTANCE_ID)),
      )
      .catch((error) => {
        console.error(`Failed to release the ${name} lease`, error);
      });
  }
}
