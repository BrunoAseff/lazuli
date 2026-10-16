import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";

import { paidCommercialPlanSchema } from "@lazuli/shared";

import { serverEnv } from "../config.ts";
import { createDatabase } from "../database/client.ts";
import { createCommercialAdminService } from "./commercial-admin-service.ts";

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
  if (command !== "credits:add-all" && command !== "credits:reset-all") return false;
  const users = await service.listUsers();
  console.log(`[${environment}] ${users.length} usuários seriam afetados.`);
  const operatorId = required("operator");
  const reason = required("reason");
  const amount = command === "credits:add-all" ? positiveInteger("amount") : null;
  const rootKey = operationKey();
  if (!flag("execute")) {
    for (const target of users)
      await service.recordDryRun({
        action: `${command}.dry-run`,
        email: target.email,
        idempotencyKey: rootKey,
        metadata: amount ? { amount } : undefined,
        operatorId,
        reason,
      });
    console.log("Dry-run concluído. Use --execute --confirm-count=<total> para executar.");
    return true;
  }
  if (Number(argument("confirm-count")) !== users.length)
    throw new Error(`--confirm-count must equal ${users.length}`);
  if (
    !(await confirm(
      `[${environment}] Você executará ${command} para ${users.length} usuários${amount ? `, ${amount} créditos cada` : ""}.`,
    ))
  )
    return true;
  let completed = 0;
  for (const target of users) {
    if (amount)
      await service.addCredits({
        amount,
        email: target.email,
        idempotencyKey: rootKey,
        operatorId,
        reason,
      });
    else
      await service.resetCredits({
        email: target.email,
        idempotencyKey: rootKey,
        operatorId,
        reason,
      });
    completed += 1;
  }
  console.log(JSON.stringify({ completed, requested: users.length }, null, 2));
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
