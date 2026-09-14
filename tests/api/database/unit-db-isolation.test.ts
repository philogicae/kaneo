import { describe, expect, it } from "vitest";
import { resolveDatabaseConfig } from "../../apps/api/src/database/resolve-database-config";

// Unit tests must never write through to the real data/kaneo.db: the resolved
// database is either in-memory or a dedicated *_test file. The unit vitest
// config pins DATABASE_PATH to data/kaneo_test.db; this test fails if that
// pin is lost and the .env fallback (data/kaneo.db) would be picked up.
describe("unit test database isolation", () => {
  it("never resolves to the real data/kaneo.db", () => {
    const { isMemory, path } = resolveDatabaseConfig();
    expect(isMemory || /_test(\.\w+)?$/.test(path)).toBe(true);
  });

  it("shares the integration suite's dedicated test database", () => {
    const { path } = resolveDatabaseConfig();
    expect(path.endsWith("data/kaneo_test.db")).toBe(true);
  });
});
