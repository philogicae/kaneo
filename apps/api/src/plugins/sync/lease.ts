import { setTimeout as delay } from "node:timers/promises";
import { withLease } from "../../database/lease";
import { SyncLeaseBusyError } from "./lease-busy-error";

// Long enough to cover a slow provider round trip without a renewal timer.
const SYNC_LEASE_MS = 15 * 60 * 1000;

export async function withSyncLease<T>(
  key: string,
  run: () => Promise<T>,
  { maxWaitMs = 5_000 }: { maxWaitMs?: number } = {},
): Promise<T> {
  const deadline = performance.now() + maxWaitMs;
  let retryDelay = 100;
  for (;;) {
    try {
      return await withLease(key, run, {
        leaseMs: SYNC_LEASE_MS,
        busy: () => new SyncLeaseBusyError(),
      });
    } catch (error) {
      if (!(error instanceof SyncLeaseBusyError)) throw error;
      const remaining = deadline - performance.now();
      if (remaining <= 0) throw error;
      await delay(Math.min(retryDelay, remaining));
      retryDelay = Math.min(retryDelay * 2, 1_000);
    }
  }
}
