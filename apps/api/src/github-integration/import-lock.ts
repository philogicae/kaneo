import { HTTPException } from "hono/http-exception";
import { withLease } from "../database/lease";

export const MAX_GITHUB_IMPORTS_IN_FLIGHT = 2;
let active = 0;

function busy() {
  return new HTTPException(429, {
    res: new Response("GitHub import is busy; retry this request", {
      status: 429,
      headers: { "Retry-After": "1" },
    }),
  });
}

/**
 * Serialise GitHub imports per integration without holding a SQL transaction.
 *
 * The lease is held across the awaited provider calls, so a second import for
 * the same integration is rejected instead of racing the first one.
 */
export async function withGithubImportLock<T>(
  id: string,
  run: () => Promise<T>,
): Promise<T> {
  if (active >= MAX_GITHUB_IMPORTS_IN_FLIGHT) throw busy();
  active++;
  try {
    return await withLease(`github-import:${id}`, run, { busy });
  } finally {
    active--;
  }
}
