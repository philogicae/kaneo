import { config } from "dotenv-mono";
import { type Config, defineConfig } from "drizzle-kit";
import { resolveDatabasePath } from "./src/database/resolve-database-config";

config();

export default defineConfig({
  out: "./drizzle",
  schema: "./src/database/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: resolveDatabasePath(),
  },
}) satisfies Config;
