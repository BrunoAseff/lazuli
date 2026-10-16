import { createInterface } from "node:readline/promises";

import { asc } from "drizzle-orm";

import { serverEnv } from "../config.ts";
import { createDatabase } from "../database/client.ts";
import { user } from "../database/schema/index.ts";
import { reconcileStorageAccounts } from "./commercial-storage-reconciliation.ts";
import { createStripeBillingService } from "./stripe-billing-service.ts";

const yes = process.argv.includes("--yes");
const repairStorage = process.argv.includes("--repair-storage");
const limitArgument = process.argv.find((value) => value.startsWith("--limit="));
const parsedLimit = limitArgument ? Number(limitArgument.slice("--limit=".length)) : 100;

if (!Number.isSafeInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 1_000)
  throw new Error("--limit must be an integer between 1 and 1000");

const confirm = async (message: string) => {
  if (yes) return true;
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await terminal.question(`${message} Deseja continuar? (y/N) `);
    return ["y", "yes"].includes(answer.trim().toLowerCase());
  } finally {
    terminal.close();
  }
};

const database = createDatabase(serverEnv.DATABASE_URL);

try {
  const stripe = createStripeBillingService(serverEnv, database.db);
  const environment = stripe
    ? serverEnv.STRIPE_SECRET_KEY!.startsWith("sk_live_")
      ? "live"
      : "test"
    : "disabled";
  if (
    !(await confirm(
      `[${serverEnv.NODE_ENV}:${environment}] Reconciliar até ${parsedLimit} usuários` +
        `${repairStorage ? " e reparar contabilidade de armazenamento" : ""}.`,
    ))
  )
    process.exitCode = 0;
  else {
    const retriedWebhooks = stripe ? await stripe.retryPendingEvents(parsedLimit) : 0;
    const subscriptions = stripe
      ? await stripe.reconcileSubscriptions(parsedLimit)
      : { issues: [], reconciled: 0, skipped: true };
    const users = await database.db
      .select({ id: user.id })
      .from(user)
      .orderBy(asc(user.id))
      .limit(parsedLimit);
    const storage = await reconcileStorageAccounts(
      database.db,
      users.map(({ id }) => id),
      { repair: repairStorage },
    );
    console.log(
      JSON.stringify(
        {
          retriedWebhooks,
          storage: { divergences: storage, repaired: repairStorage ? storage.length : 0 },
          subscriptions,
        },
        null,
        2,
      ),
    );
    if (subscriptions.issues.length || (storage.length && !repairStorage)) process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await database.client.end({ timeout: 5 });
}
