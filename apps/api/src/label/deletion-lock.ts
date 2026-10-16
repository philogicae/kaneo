import { HTTPException } from "hono/http-exception";
import { withLease } from "../database/lease";

export const MAX_LABEL_DELETIONS_IN_FLIGHT = 4;
let active = 0;

function busy() {
  return new HTTPException(429, {
    res: new Response("Label deletion is busy; retry this request", {
      status: 429,
      headers: { "Retry-After": "1" },
    }),
  });
}

/**
 * Serialise label deletion per label without holding a SQL transaction.
 *
 * The lease is held across the awaited provider calls, so two requests cannot
 * interleave their link detaches for the same label.
 */
export async function withLabelDeletionLock<T>(
  id: string,
  run: () => Promise<T>,
): Promise<T> {
  if (active >= MAX_LABEL_DELETIONS_IN_FLIGHT) throw busy();
  active++;
  try {
    return await withLease(`label-delete:${id}`, run, { busy });
  } finally {
    active--;
  }
}
