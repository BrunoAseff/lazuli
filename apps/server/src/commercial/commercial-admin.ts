import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";

import { paidCommercialPlanSchema } from "@lazuli/shared";

import { serverEnv } from "../config.ts";
import { createDatabase } from "../database/client.ts";
import { createCommercialAdminService } from "./commercial-admin-service.ts";
import { isBulkAdminCommand, runBulkAdminCommand } from "./commercial-admin-bulk.ts";

const [, , command, ...rawArguments] = process.argv;
const argument = (name: string) => {
  const equals = rawArguments.find((value) => value.startsWith(`--${name}=`));
  if (equals) return equals.slice(name.length + 3);
  const index = rawArguments.indexOf(`--${name}`);
  return index >= 0 ? rawArguments[index + 1] : undefined;
};
const flag = (name: string) => rawArguments.includes(`--${name}`);
const required = (name: string) => {
  const value = argument(name)?.trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
};
const positiveInteger = (name: string) => {
  const value = Number(required(name));
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`--${name} must be a positive integer`);
  return value;
};
const operationKey = () => argument("idempotency-key") ?? randomUUID();

const confirm = async (message: string) => {
  if (flag("yes")) return true;
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await terminal.question(`${message} Deseja continuar? (y/N) `);
    return ["y", "yes"].includes(answer.trim().toLowerCase());
  } finally {
    terminal.close();
  }
};

const database = createDatabase(serverEnv.DATABASE_URL);
const environment = `${serverEnv.NODE_ENV}:${serverEnv.BILLING_ENABLED ? "billing-on" : "billing-off"}`;
const service = createCommercialAdminService(database.db, environment);

const runSingle = async () => {
  const email = required("email").toLowerCase();
  if (command === "user:show") {
    const result = await service.showUser(email);
    if (!result) throw new Error(`User ${email} was not found`);
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const operatorId = required("operator");
  const reason = required("reason");
  const idempotencyKey = operationKey();
  if (command === "credits:add") {
    const amount = positiveInteger("amount");
    if (!(await confirm(`[${environment}] Você adicionará ${amount} créditos a ${email}.`))) return;
    console.log(
      JSON.stringify(
        await service.addCredits({ amount, email, idempotencyKey, operatorId, reason }),
        null,
        2,
      ),
    );
    return;
  }
  if (command === "credits:reset") {
    if (!(await confirm(`[${environment}] Você renovará a franquia mensal de ${email}.`))) return;
    console.log(
      JSON.stringify(
        await service.resetCredits({ email, idempotencyKey, operatorId, reason }),
        null,
        2,
      ),
    );
    return;
  }
  if (command === "plan:grant") {
    const plan = paidCommercialPlanSchema.parse(required("plan"));
    const until = argument("until");
    const endsAt = until ? new Date(until) : null;
    if (endsAt && Number.isNaN(endsAt.getTime())) throw new Error("--until must be a valid date");
    if (!(await confirm(`[${environment}] Você concederá o plano ${plan} a ${email}.`))) return;
    console.log(
      JSON.stringify(
        await service.grantPlan({
          email,
          endsAt,
          idempotencyKey,
          operatorId,
          plan,
          reason,
        }),
        null,
        2,
      ),
    );
    return;
  }
  if (command === "plan:revoke") {
    if (!(await confirm(`[${environment}] Você revogará concessões administrativas de ${email}.`)))
      return;
    console.log(
      JSON.stringify(
        await service.revokePlan({ email, idempotencyKey, operatorId, reason }),
        null,
        2,
      ),
    );
    return;
  }
  throw new Error(`Unknown command: ${command ?? "missing"}`);
};

const runBulk = async () => {
  if (!isBulkAdminCommand(command)) return false;
  const operatorId = required("operator");
  const reason = required("reason");
  const amount = command === "credits:add-all" ? positiveInteger("amount") : null;
  const plan =
    command === "plan:grant-all" ? paidCommercialPlanSchema.parse(required("plan")) : null;
  const rootKey = operationKey();
  await runBulkAdminCommand({
    amount: amount ?? undefined,
    command,
    confirm,
    confirmCount: argument("confirm-count") ? Number(argument("confirm-count")) : undefined,
    environment,
    execute: flag("execute"),
    log: console.log,
    operatorId,
    plan: plan ?? undefined,
    reason,
    rootKey,
    service,
  });
  return true;
};

try {
  if (!(await runBulk())) await runSingle();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await database.client.end({ timeout: 5 });
}
