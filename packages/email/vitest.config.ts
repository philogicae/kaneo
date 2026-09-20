import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Every workspace runs at once under turbo; keep one suite from occupying the whole CPU.
    maxWorkers: 3,
    fsModuleCache: true,
    // Six vitest processes run at once under turbo; a shared root cache races
    // on cleanup right after a lockfile change (all clear it simultaneously,
    // ENOTEMPTY). Keep one cache directory per workspace.
    fsModuleCachePath: "node_modules/.vitest-cache",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}"],
      // CI emits a machine-readable summary for the job report; local runs stay text-only.
      reporter: process.env.CI ? ["text", "json-summary"] : ["text"],
      reportsDirectory: "./coverage",
    },
  },
});
