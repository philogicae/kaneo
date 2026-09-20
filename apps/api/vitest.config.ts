import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests may only write to the dedicated *_test database, never to the
// real data/kaneo.db. Pinning the path here keeps that guarantee even when
// the local .env omits DATABASE_PATH (whose fallback is kaneo.db) or points
// it at the real database.
const testDatabasePath = resolve(
  import.meta.dirname,
  "../../data/kaneo_test.db",
);

export default defineConfig({
  test: {
    environment: "node",
    include: ["../../tests/api/**/*.test.ts"],
    env: {
      DATABASE_PATH: testDatabasePath,
    },
    // Every workspace runs at once under turbo; keep one suite from occupying the whole CPU.
    maxWorkers: 3,
    fsModuleCache: true,
    // Six vitest processes run at once under turbo; a shared root cache races
    // on cleanup right after a lockfile change (all clear it simultaneously,
    // ENOTEMPTY). Keep one cache directory per workspace.
    fsModuleCachePath: "node_modules/.vitest-cache",
    coverage: {
      provider: "v8",
      all: true,
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      // CI emits a machine-readable summary for the job report; local runs stay text-only.
      reporter: process.env.CI ? ["text", "json-summary"] : ["text"],
      reportsDirectory: "./coverage",
    },
  },
});
