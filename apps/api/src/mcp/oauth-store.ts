import { and, count, eq, gt, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { withLease } from "../database/lease";
import { mcpOauthStateTable } from "../database/schema";

export type OauthStateKind = "client" | "code" | "request";
export const OAUTH_STATE_LIMITS = {
  client: { rows: 1_000, perMinute: 60, perClient: 0, lock: 1 },
  request: { rows: 10_000, perMinute: 300, perClient: 20, lock: 2 },
  code: { rows: 10_000, perMinute: 300, perClient: 20, lock: 3 },
} as const;
export const OAUTH_PAYLOAD_BYTES = 32 * 1024;
export const EXPIRED_STATE_BATCH = 100;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Signals that another request holds this OAuth issuance slot. */
class OAuthSlotBusy extends Error {
  constructor() {
    super("OAuth state slot is busy");
    this.name = "OAuthSlotBusy";
  }
}

async function sweepExpired(dbOrTx: typeof db | Transaction) {
  // Never issue an unbounded delete or evict a live consent request. Fixed
  // rate-counter rows are reused rather than accumulated per time window.
  // Drizzle stores these timezone-less timestamps as epoch milliseconds, and
  // SQLite serialises writers, so the sweep needs no row lock.
  await dbOrTx.run(sql`
    DELETE FROM ${mcpOauthStateTable} WHERE id IN (
      SELECT id FROM ${mcpOauthStateTable}
      WHERE kind <> 'rate' AND expires_at <= ${Date.now()}
      ORDER BY expires_at LIMIT ${EXPIRED_STATE_BATCH}
    )
  `);
}

export async function putState(
  kind: OauthStateKind,
  key: string,
  payload: unknown,
  expiresAt: Date,
  consumeRequestId?: string,
): Promise<void> {
  const serialized = JSON.stringify(payload);
  if (
    typeof serialized !== "string" ||
    Buffer.byteLength(serialized) > OAUTH_PAYLOAD_BYTES ||
    key.length > 128
  ) {
    throw new HTTPException(413, { message: "OAuth state is too large" });
  }
  const clientId =
    payload && typeof payload === "object" && "clientId" in payload
      ? payload.clientId
      : undefined;
  const limits = OAUTH_STATE_LIMITS[kind];
  // Separate fixed slots keep a registration flood from occupying the code
  // issuance slot. A short lease bounds the queue during concurrent floods;
  // SQLite serialises writers, so the transaction itself is the exclusion.
  const now = new Date();
  let denial: string | null = null;
  try {
    denial = await withLease(
      `mcp-oauth-state:${limits.lock}`,
      () =>
        db.transaction(async (tx) => {
          await sweepExpired(tx);
          const [rate] = await tx
            .select()
            .from(mcpOauthStateTable)
            .where(
              and(
                eq(mcpOauthStateTable.kind, "rate"),
                eq(mcpOauthStateTable.key, kind),
              ),
            )
            .limit(1);
          const used =
            rate && rate.expiresAt > now
              ? Number((rate.payload as { count?: number }).count ?? 0)
              : 0;
          if (
            !Number.isSafeInteger(used) ||
            used < 0 ||
            used >= limits.perMinute
          )
            return "rate";
          const [total] = await tx
            .select({ total: count() })
            .from(
              tx
                .select({ id: mcpOauthStateTable.id })
                .from(mcpOauthStateTable)
                .where(eq(mcpOauthStateTable.kind, kind))
                .limit(limits.rows)
                .as("bounded_states"),
            );
          if ((total?.total ?? limits.rows) >= limits.rows) return "capacity";
          if (limits.perClient && typeof clientId === "string") {
            const [clientTotal] = await tx.select({ total: count() }).from(
              tx
                .select({ id: mcpOauthStateTable.id })
                .from(mcpOauthStateTable)
                .where(
                  and(
                    eq(mcpOauthStateTable.kind, kind),
                    sql`json_extract(${mcpOauthStateTable.payload}, '$.clientId') = ${clientId}`,
                  ),
                )
                .limit(limits.perClient)
                .as("bounded_client_states"),
            );
            if ((clientTotal?.total ?? limits.perClient) >= limits.perClient)
              return "client";
          }
          if (consumeRequestId) {
            const consumed = await tx
              .delete(mcpOauthStateTable)
              .where(
                and(
                  eq(mcpOauthStateTable.kind, "request"),
                  eq(mcpOauthStateTable.key, consumeRequestId),
                  gt(mcpOauthStateTable.expiresAt, now),
                ),
              )
              .returning({ id: mcpOauthStateTable.id });
            if (!consumed.length) return "missing-request";
          }
          await tx
            .insert(mcpOauthStateTable)
            .values({ kind, key, payload, expiresAt });
          const rateExpires = new Date(
            (Math.floor(now.getTime() / 60_000) + 1) * 60_000,
          );
          await tx
            .insert(mcpOauthStateTable)
            .values({
              kind: "rate",
              key: kind,
              payload: { count: used + 1 },
              expiresAt: rateExpires,
            })
            .onConflictDoUpdate({
              target: [mcpOauthStateTable.kind, mcpOauthStateTable.key],
              set: { payload: { count: used + 1 }, expiresAt: rateExpires },
            });
          return null;
        }),
      // A held slot means a concurrent flood is already being bounded.
      { busy: () => new OAuthSlotBusy(), leaseMs: 5_000 },
    );
  } catch (error) {
    // A held slot is a denial, not a failure: report it so the caller can
    // answer 429 instead of 500.
    if (!(error instanceof OAuthSlotBusy)) throw error;
    denial = "busy";
  }
  // Return denials outside the transaction: expired-row cleanup must commit
  // even when a legacy over-cap table refuses this insert.
  if (denial === "missing-request")
    throw new HTTPException(404, {
      res: Response.json(
        { error: "invalid_or_expired_request" },
        { status: 404 },
      ),
    });
  if (denial)
    throw new HTTPException(429, {
      res: Response.json(
        {
          error: "temporarily_unavailable",
          error_description: "OAuth capacity reached; retry later",
        },
        {
          status: 429,
          headers: {
            "Retry-After": denial === "busy" ? "1" : "60",
            "Cache-Control": "no-store",
          },
        },
      ),
    });
}

export async function getState<T>(
  kind: OauthStateKind,
  key: string,
): Promise<T | null> {
  const [row] = await db
    .select()
    .from(mcpOauthStateTable)
    .where(
      and(eq(mcpOauthStateTable.kind, kind), eq(mcpOauthStateTable.key, key)),
    )
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  return row.payload as T;
}

// Single DELETE ... RETURNING keeps consumption single-use across replicas.
export async function consumeState<T>(
  kind: OauthStateKind,
  key: string,
): Promise<T | null> {
  const [row] = await db
    .delete(mcpOauthStateTable)
    .where(
      and(eq(mcpOauthStateTable.kind, kind), eq(mcpOauthStateTable.key, key)),
    )
    .returning();

  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  return row.payload as T;
}

export async function deleteExpiredStates(): Promise<void> {
  await sweepExpired(db);
}
