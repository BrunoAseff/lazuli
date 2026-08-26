import { and, eq } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import { project } from "../database/schema/index.ts";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type QueryExecutor = Database | Transaction;

export const ownsProject = async (database: QueryExecutor, userId: string, projectId: string) => {
  const [owned] = await database
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .limit(1)
    .for("share");
  return Boolean(owned);
};
