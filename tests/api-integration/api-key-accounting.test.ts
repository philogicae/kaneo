import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { verifyApiKey } from "../../apps/api/src/utils/verify-api-key";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(resetTestDatabase);
async function seedKey(
  overrides: Partial<typeof schema.apikeyTable.$inferInsert> = {},
) {
  const { user } = await createWorkspaceMember();
  const key = `review-test-${user.id}`.padEnd(64, "x");
  const [row] = await db
    .insert(schema.apikeyTable)
    .values({
      referenceId: user.id,
      userId: user.id,
      key: createHash("sha256").update(key).digest("base64url"),
      createdAt: new Date(),
      updatedAt: new Date(),
      rateLimitEnabled: true,
      rateLimitMax: 2,
      rateLimitTimeWindow: 60000,
      ...overrides,
    })
    .returning();
  return { key, row };
}

describe("API key accounting", () => {
  it("denies an exhausted quota", async () => {
    const { key } = await seedKey({ remaining: 0 });
    expect(await verifyApiKey(key)).toBeNull();
  });
  it("enforces a rate window across concurrent requests", async () => {
    const { key, row } = await seedKey();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => verifyApiKey(key)),
    );
    expect(results.filter(Boolean)).toHaveLength(2);
    const [saved] = await db
      .select()
      .from(schema.apikeyTable)
      .where(eq(schema.apikeyTable.id, row.id));
    expect(saved.requestCount).toBe(2);
  });
  it("atomically consumes the last remaining request", async () => {
    const { key } = await seedKey({ remaining: 1, rateLimitEnabled: false });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => verifyApiKey(key)),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  it("refills eligible quota and resets an expired window", async () => {
    const old = new Date(Date.now() - 120000);
    const { key } = await seedKey({
      remaining: 0,
      refillAmount: 3,
      refillInterval: 60000,
      lastRefillAt: old,
      lastRequest: old,
      requestCount: 2,
    });
    expect(await verifyApiKey(key)).toMatchObject({ valid: true });
  });
});

it("charges an auth request once when the identity guard precedes Better Auth", async () => {
  const { key, row } = await seedKey({ remaining: 1, rateLimitEnabled: false });
  const { createApp } = await import("../../apps/api/src/index");
  const { app } = createApp();
  const response = await app.request("/api/auth/get-session", {
    headers: { "x-api-key": key },
  });
  expect(response.status, await response.clone().text()).toBe(200);
  expect(await response.json()).toMatchObject({
    user: { id: row.referenceId },
  });
  const [saved] = await db
    .select()
    .from(schema.apikeyTable)
    .where(eq(schema.apikeyTable.id, row.id));
  expect(saved.remaining).toBe(0);
});

it("creates normal API keys with the configured 100-per-minute limit", async () => {
  const { user } = await createWorkspaceMember();
  const created = await auth.api.createApiKey({
    body: { userId: user.id, name: "default limits" },
  });
  const [saved] = await db
    .select()
    .from(schema.apikeyTable)
    .where(eq(schema.apikeyTable.id, created.id));
  expect(saved.rateLimitMax).toBe(100);
  expect(saved.rateLimitTimeWindow).toBe(60_000);
  for (let i = 0; i < 11; i++)
    expect(await verifyApiKey(created.key)).not.toBeNull();
});

it.each([true, false])(
  "rejects a key that expires while waiting for the write lock (consume=%s)",
  async (consume) => {
    const expiresAt = new Date(Date.now() + 600);
    const { key, row } = await seedKey({ expiresAt, remaining: 1 });
    let release!: () => void;
    let ready!: () => void;
    const held = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    // SQLite serialises writers, so an open write transaction is this
    // deployment's row lock: the verification below queues behind it.
    const holder = db.transaction(async (tx) => {
      await tx.run(sql`update ${schema.apikeyTable} set name = name`);
      ready();
      await hold;
    });
    await held;
    try {
      const verification = verifyApiKey(key, { consume });
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, expiresAt.getTime() - Date.now() + 50)),
      );
      release();
      await expect(verification).resolves.toBeNull();
      const [saved] = await db
        .select()
        .from(schema.apikeyTable)
        .where(eq(schema.apikeyTable.id, row.id));
      expect(saved.remaining).toBe(1);
      expect(saved.requestCount).toBe(0);
    } finally {
      release();
      await holder;
    }
  },
);
