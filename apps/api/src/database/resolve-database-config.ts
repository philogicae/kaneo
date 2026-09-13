import { isAbsolute, resolve } from "node:path";

const LOCAL_FALLBACK_PATH = "./data/kaneo.db";

export type DatabaseConfigSource = "DATABASE_PATH" | "LOCAL_FALLBACK";

export type ResolvedDatabaseConfig = {
  /** Absolute local file path, or ":memory:". */
  path: string;
  /** libSQL connection URL derived from the path. */
  url: string;
  isMemory: boolean;
  source: DatabaseConfigSource;
  logConfig: {
    source: DatabaseConfigSource;
    path: string;
  };
};

export function resolveDatabaseConfig(): ResolvedDatabaseConfig {
  const raw = process.env.DATABASE_PATH?.trim();
  const source: DatabaseConfigSource =
    raw && raw.length > 0 ? "DATABASE_PATH" : "LOCAL_FALLBACK";
  const input = raw && raw.length > 0 ? raw : LOCAL_FALLBACK_PATH;

  if (input === ":memory:" || input === "file::memory:") {
    return {
      path: ":memory:",
      url: ":memory:",
      isMemory: true,
      source,
      logConfig: { source, path: ":memory:" },
    };
  }

  const withoutScheme = input.startsWith("file:")
    ? input.slice("file:".length)
    : input;
  const path = isAbsolute(withoutScheme)
    ? withoutScheme
    : resolve(process.cwd(), withoutScheme);

  return {
    path,
    url: `file:${path}`,
    isMemory: false,
    source,
    logConfig: { source, path },
  };
}

export function resolveDatabasePath(): string {
  return resolveDatabaseConfig().path;
}

export function resolveDatabaseUrl(): string {
  return resolveDatabaseConfig().url;
}
