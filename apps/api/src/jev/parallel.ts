// Bounded fan-out for Jev batches.
//
// The reference implementation runs its batch fan-out through a fixed worker
// pool: an unbounded Promise.all trips upstream rate limits and local listen
// backlogs when a wide candidate list splits into many requests. Thunks (not
// promises) keep the limit real - a promise starts its fetch the moment it is
// created, a thunk only when a worker calls it. The endpoint answers in ~1 s
// solo but queues beyond ~4 concurrent calls, so 4 is the shipped default.

export const DEFAULT_JEV_CONCURRENCY = 4;

export function jevConcurrency(): number {
  const raw = Number.parseInt(
    process.env.KANEO_JEV_MAX_CONCURRENCY?.trim() ?? "",
    10,
  );
  return Number.isFinite(raw) ? Math.max(1, raw) : DEFAULT_JEV_CONCURRENCY;
}

export async function gatherBounded<T>(
  tasks: Array<() => Promise<T>>,
  limit = jevConcurrency(),
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, tasks.length)) },
    async () => {
      while (next < tasks.length) {
        const index = next++;
        const task = tasks[index];
        if (!task) continue;
        results[index] = await task();
      }
    },
  );
  await Promise.all(workers);
  return results;
}
