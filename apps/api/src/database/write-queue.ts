import { AsyncLocalStorage } from "node:async_hooks";
import type { Client, Transaction } from "@libsql/client";

/**
 * In-process write serialisation for a single-instance deployment.
 *
 * SQLite has one writer, and libSQL's busy handler does not retry: a second
 * writer gets SQLITE_BUSY as soon as it tries, so `busy_timeout` buys nothing
 * and only delays the failure. This fork runs one Kaneo process against one
 * database file, so a queue in front of the database is the whole answer.
 *
 * A transaction holds its slot from BEGIN until it commits or rolls back.
 * libSQL's `transaction()` does not do that on its own: it returns a handle
 * and the caller commits later, so the slot has to be released by the wrapper
 * below rather than when `transaction()` returns.
 *
 * The `AsyncLocalStorage` flag keeps a statement issued from inside a queued
 * write (a `db` call from within a transaction callback) from waiting behind
 * itself.
 */
const inWrite = new AsyncLocalStorage<true>();
let tail: Promise<unknown> = Promise.resolve();

const BUSY_CODES = new Set(["SQLITE_BUSY", "SQLITE_LOCKED"]);
const RETRY_DELAYS_MS = [5, 15, 40, 100, 250];

function isBusy(error: unknown): boolean {
  for (
    let current: unknown = error;
    current;
    current = (current as { cause?: unknown }).cause
  ) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && BUSY_CODES.has(code)) return true;
  }
  return false;
}

/** Runs `work`, retrying while the writer is busy (another process, say). */
async function withBusyRetry<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !isBusy(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function withSlot<T>(work: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = tail;
  tail = previous.then(
    () => held,
    () => held,
  );
  await previous.catch(() => undefined);
  try {
    return await inWrite.run(true, () => withBusyRetry(work));
  } finally {
    release();
  }
}

/**
 * Wraps a libSQL client so standalone statements queue behind each other and
 * each transaction holds the queue until it settles.
 */
export function serialiseClientWrites(client: Client): Client {
  return new Proxy(client, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;

      if (property === "execute" || property === "batch") {
        const call = value as (...args: unknown[]) => Promise<unknown>;
        return (...args: unknown[]) =>
          inWrite.getStore()
            ? withBusyRetry(() => call.apply(target, args))
            : withSlot(() => call.apply(target, args));
      }

      if (property === "transaction") {
        const call = value as (
          ...args: unknown[]
        ) => Promise<Transaction | Transaction[]>;
        return async (...args: unknown[]) => {
          if (inWrite.getStore())
            return withBusyRetry(() => call.apply(target, args));

          let release!: () => void;
          const held = new Promise<void>((resolve) => {
            release = resolve;
          });
          const previous = tail;
          tail = previous.then(
            () => held,
            () => held,
          );
          await previous.catch(() => undefined);

          let transaction: Transaction | Transaction[];
          try {
            transaction = await withBusyRetry(() => call.apply(target, args));
          } catch (error) {
            release();
            throw error;
          }

          if (Array.isArray(transaction))
            return transaction.map((entry) => releaseOnSettle(entry, release));
          return releaseOnSettle(transaction, release);
        };
      }

      return value.bind(target);
    },
  });
}

/** Releases the queue slot once the transaction commits, rolls back or closes. */
function releaseOnSettle(
  transaction: Transaction,
  release: () => void,
): Transaction {
  let released = false;
  const settle = () => {
    if (released) return;
    released = true;
    release();
  };
  return new Proxy(transaction, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (
        (property === "commit" ||
          property === "rollback" ||
          property === "close") &&
        typeof value === "function"
      ) {
        const call = value as (...args: unknown[]) => Promise<unknown>;
        return (...args: unknown[]) =>
          Promise.resolve(call.apply(target, args)).finally(settle);
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
