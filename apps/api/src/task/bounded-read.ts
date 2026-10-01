import { HTTPException } from "hono/http-exception";
import db from "../database";

export type TaskReadDatabase =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run a task read inside a transaction and translate a timeout into a
 * retryable 503.
 *
 * Upstream bounded this with a Postgres `statement_timeout` inside a read-only
 * repeatable-read transaction. libSQL has neither, so the bound comes from the
 * `busy_timeout` pragma applied at startup; the Postgres error code check is
 * kept because a proxy or driver in front of libSQL can still surface it.
 */
export async function boundedTaskRead<T>(
  read: (tx: TaskReadDatabase) => Promise<T>,
  message = "Description request took too long; retry later",
) {
  try {
    return await db.transaction(async (tx) => read(tx));
  } catch (error) {
    const cause = error instanceof Error ? (error.cause ?? error) : error;
    if (
      cause &&
      typeof cause === "object" &&
      "code" in cause &&
      cause.code === "57014"
    )
      throw new HTTPException(503, { message });
    throw error;
  }
}
