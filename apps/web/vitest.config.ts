import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    // Every workspace runs at once under turbo; keep one suite from occupying the whole CPU.
    maxWorkers: 3,
    // Tests are normally sub-second, but loaded CI runners flakily push the same tests past
    // the 5s vitest default (observed 6.5s+); give them headroom without masking hangs.
    testTimeout: 10_000,
    fsModuleCache: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**"],
      // CI emits a machine-readable summary for the job report; local runs stay text-only.
      reporter: process.env.CI ? ["text", "json-summary"] : ["text"],
      reportsDirectory: "./coverage",
    },
  },
});
