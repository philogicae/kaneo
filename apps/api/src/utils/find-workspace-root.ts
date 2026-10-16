import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Locates the repository root — the directory holding pnpm-workspace.yaml — so
 * repo-relative assets resolve the same way whether the API runs from
 * apps/api, the repository root, or the container's /app.
 */
export function findWorkspaceRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return startDir;
    }
    dir = parent;
  }
}
