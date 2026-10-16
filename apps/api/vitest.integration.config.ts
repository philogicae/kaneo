import { resolve } from "node:path";
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "node",
    include: ["../../tests/api-integration/**/*.test.ts"],
    setupFiles: ["../../tests/api-integration/setup.ts"],
    // Each worker migrates and truncates its own `*_test_w<N>.db` (see
    // tests/api-integration/setup.ts), so files run in parallel instead of
    // queueing behind one writer. Half the cores, so a 4-core CI runner stays
    // at 2 and a workstation still gets several workers; each one holds its own
    // SQLite connection and its own server sockets.
    fileParallelism: true,
    maxWorkers: "50%",
    minWorkers: 1,
    hookTimeout: 60_000,
    testTimeout: 60_000,
    coverage: {
      enabled: false,
    },
  },
  resolve: {
    alias: {
      "@kaneo/email": resolve(
        import.meta.dirname,
        "../../tests/api-integration/mocks/email.ts",
      ),
    },
  },
});
