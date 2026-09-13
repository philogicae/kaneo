import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resolveDatabaseConfig,
  resolveDatabasePath,
  resolveDatabaseUrl,
} from "../../../apps/api/src/database/resolve-database-config";

const KEY = "DATABASE_PATH" as const;

describe("resolve-database-config", () => {
  const original = process.env[KEY];

  beforeEach(() => {
    delete process.env[KEY];
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env[KEY];
    } else {
      process.env[KEY] = original;
    }
  });

  it("uses an absolute DATABASE_PATH", () => {
    process.env[KEY] = "/data/kaneo.db";

    expect(resolveDatabaseConfig()).toMatchObject({
      path: "/data/kaneo.db",
      url: "file:/data/kaneo.db",
      isMemory: false,
      source: "DATABASE_PATH",
    });
    expect(resolveDatabasePath()).toBe("/data/kaneo.db");
    expect(resolveDatabaseUrl()).toBe("file:/data/kaneo.db");
  });

  it("resolves a relative DATABASE_PATH against the repository root", () => {
    const repoRoot = resolve(import.meta.dirname, "../../..");
    process.env[KEY] = "./data/kaneo.db";

    expect(resolveDatabaseConfig()).toMatchObject({
      path: resolve(repoRoot, "./data/kaneo.db"),
      url: `file:${resolve(repoRoot, "./data/kaneo.db")}`,
      source: "DATABASE_PATH",
    });
  });

  it("normalizes a file: prefix", () => {
    process.env[KEY] = "file:/data/kaneo.db";

    expect(resolveDatabaseConfig()).toMatchObject({
      path: "/data/kaneo.db",
      url: "file:/data/kaneo.db",
      source: "DATABASE_PATH",
    });
  });

  it("supports an in-memory database", () => {
    process.env[KEY] = ":memory:";

    expect(resolveDatabaseConfig()).toMatchObject({
      path: ":memory:",
      url: ":memory:",
      isMemory: true,
      source: "DATABASE_PATH",
    });
  });

  it("falls back to ./data/kaneo.db when unset", () => {
    const repoRoot = resolve(import.meta.dirname, "../../..");

    expect(resolveDatabaseConfig()).toMatchObject({
      path: resolve(repoRoot, "./data/kaneo.db"),
      isMemory: false,
      source: "LOCAL_FALLBACK",
    });
  });

  it("trims whitespace-only DATABASE_PATH to the fallback", () => {
    process.env[KEY] = "   ";

    expect(resolveDatabaseConfig()).toMatchObject({
      source: "LOCAL_FALLBACK",
    });
  });
});
