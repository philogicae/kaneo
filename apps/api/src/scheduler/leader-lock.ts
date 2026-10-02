import { withLease } from "../database/lease";

/** Signals that another holder owns the lease, so the caller can skip quietly. */
class LeaseHeldError extends Error {
  constructor(name: string) {
    super(`Lease ${name} is held elsewhere`);
    this.name = "LeaseHeldError";
  }
}

/**
 * Run `run` while holding the named job lease, or return `whenHeldElsewhere`
 * when another holder has it.
 *
 * Scheduled replay work uses this instead of `withLease` (which throws) because
 * losing the lease race is the normal case for a single-instance deployment:
 * the other holder is already doing the work.
 */
export async function withJobLease<T>(
  name: string,
  run: () => Promise<T>,
  whenHeldElsewhere: () => T,
  leaseMs?: number,
): Promise<T> {
  try {
    return await withLease(name, run, {
      busy: () => new LeaseHeldError(name),
      ...(leaseMs ? { leaseMs } : {}),
    });
  } catch (error) {
    if (error instanceof LeaseHeldError) return whenHeldElsewhere();
    throw error;
  }
}
