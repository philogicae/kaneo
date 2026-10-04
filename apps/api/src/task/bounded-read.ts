import { HTTPException } from "hono/http-exception";
import db from "../database";

export type TaskReadDatabase =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export const DEFAULT_READ_DEADLINE_MS = 5_000;

// Driver codes for "this statement did not finish in time": Postgres' 57014
// plus the SQLite busy/interrupted ones a proxy in front of libSQL can raise.
const TIMEOUT_CODES = new Set([
  "57014",
  "SQLITE_BUSY",
  "SQLITE_INTERRUPT",
  "SQLITE_LOCKED",
]);

function isTimeout(error: unknown) {
  for (
    let current: unknown = error;
    current;
    current = (current as { cause?: unknown }).cause
  ) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && TIMEOUT_CODES.has(code)) return true;
  }
  return false;
}

/**
 * Run a task read inside a transaction, under a deadline, and translate a
 * timeout into a retryable 503.
 *
 * Upstream bounded this with a Postgres `statement_timeout` inside a read-only
 * repeatable-read transaction. libSQL has no statement timeout, so the deadline
 * is enforced here instead; the driver-code check stays for a proxy or driver
 * in front of libSQL that raises one of its own.
 */
export async function boundedTaskRead<T>(
  read: (tx: TaskReadDatabase) => Promise<T>,
  message = "Description request took too long; retry later",
  deadlineMs = DEFAULT_READ_DEADLINE_MS,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      db.transaction(async (tx) => read(tx)),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new HTTPException(503, { message })),
          deadlineMs,
        );
      }),
    ]);
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    if (isTimeout(error)) throw new HTTPException(503, { message });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
