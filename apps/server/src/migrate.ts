import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";

import { serverEnv } from "./config.ts";
import { createDatabase } from "./database/client.ts";

const database = createDatabase(serverEnv.DATABASE_URL);
const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

try {
  await migrate(database.db, { migrationsFolder });
  console.info("database migrations completed");
} catch (error) {
  console.error("database migrations failed", error);
  process.exitCode = 1;
} finally {
  await database.client.end({ timeout: 5 });
}
