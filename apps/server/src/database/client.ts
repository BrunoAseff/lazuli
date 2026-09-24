import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index.ts";

export const createDatabase = (connectionString: string) => {
  const client = postgres(connectionString, {
    max: 10,
    prepare: false,
  });

  return {
    client,
    db: drizzle(client, { schema }),
  };
};

export type Database = ReturnType<typeof createDatabase>["db"];
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type QueryExecutor = Database | Transaction;
