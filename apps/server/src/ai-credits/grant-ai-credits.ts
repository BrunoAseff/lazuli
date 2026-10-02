import { serverEnv } from "../config.ts";
import { createDatabase } from "../database/client.ts";
import { AI_TEST_PARTICIPANT_GRANT } from "./ai-credit-config.ts";
import { createAiCreditService } from "./ai-credit-service.ts";

const readArgument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const email = readArgument("email");
const userId = readArgument("user-id");
const operatorId = readArgument("operator");
const reason = readArgument("reason");
const idempotencyKey = readArgument("idempotency-key");
const amount = Number(readArgument("amount") ?? AI_TEST_PARTICIPANT_GRANT);

if ((!email && !userId) || (email && userId))
  throw new Error("Provide exactly one of --email or --user-id");
if (!operatorId || !reason || !idempotencyKey)
  throw new Error("--operator, --reason and --idempotency-key are required");
if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("--amount must be positive");

const database = createDatabase(serverEnv.DATABASE_URL);
try {
  const result = await createAiCreditService(database.db).grant({
    amount,
    email,
    idempotencyKey,
    operatorId,
    reason,
    userId,
  });
  if (result.kind === "user-not-found") throw new Error("User not found");
  if (result.kind === "invalid-target") throw new Error("Invalid user target");
  process.stdout.write(
    `${result.created ? "Granted" : "Already granted"}: ${result.account.availableBalance} available, ${result.account.reservedBalance} reserved\n`,
  );
} finally {
  await database.client.end({ timeout: 1 });
}
