import type { CommercialPlan } from "@lazuli/shared";

type PaidCommercialPlan = Exclude<CommercialPlan, "basic">;

type BulkUser = { email: string; id: string };

type BulkAdminService = {
  addCredits(input: {
    amount: number;
    email: string;
    idempotencyKey: string;
    operatorId: string;
    reason: string;
  }): Promise<unknown>;
  grantPlan(input: {
    email: string;
    idempotencyKey: string;
    operatorId: string;
    plan: PaidCommercialPlan;
    reason: string;
    skipIfAlreadyGranted: true;
  }): Promise<{
    result: { alreadyGranted?: boolean; created?: boolean; replayed?: boolean };
  } | null>;
  listUsers(): Promise<BulkUser[]>;
  recordDryRun(input: {
    action: string;
    email: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
    operatorId: string;
    reason: string;
  }): Promise<unknown>;
  resetCredits(input: {
    email: string;
    idempotencyKey: string;
    operatorId: string;
    reason: string;
  }): Promise<unknown>;
};

export type BulkAdminCommand = "credits:add-all" | "credits:reset-all" | "plan:grant-all";

export const isBulkAdminCommand = (command: string | undefined): command is BulkAdminCommand =>
  command === "credits:add-all" || command === "credits:reset-all" || command === "plan:grant-all";

export const getBulkTargetIdempotencyKey = (rootKey: string, userId: string) =>
  `${rootKey}:user:${userId}`;

export const runBulkAdminCommand = async (input: {
  amount?: number;
  command: BulkAdminCommand;
  confirm: (message: string) => Promise<boolean>;
  confirmCount?: number;
  environment: string;
  execute: boolean;
  log: (message: string) => void;
  operatorId: string;
  plan?: PaidCommercialPlan;
  reason: string;
  rootKey: string;
  service: BulkAdminService;
}) => {
  if (
    input.command === "credits:add-all" &&
    (!Number.isSafeInteger(input.amount) || (input.amount ?? 0) <= 0)
  )
    throw new Error("amount must be a positive integer");
  if (input.command === "plan:grant-all" && !input.plan)
    throw new Error("plan is required for plan:grant-all");

  const users = await input.service.listUsers();
  input.log(`[${input.environment}] ${users.length} usuários encontrados.`);

  const metadata =
    input.command === "credits:add-all"
      ? { amount: input.amount }
      : input.command === "plan:grant-all"
        ? { plan: input.plan }
        : undefined;

  if (!input.execute) {
    const dryRunKey = `${input.rootKey}:dry-run`;
    for (const target of users)
      await input.service.recordDryRun({
        action: `${input.command}.dry-run`,
        email: target.email,
        idempotencyKey: dryRunKey,
        metadata,
        operatorId: input.operatorId,
        reason: input.reason,
      });
    input.log("Dry-run concluído. Use --execute --confirm-count=<total> para executar.");
    return { completed: 0, requested: users.length, skipped: 0 };
  }

  if (input.confirmCount !== users.length)
    throw new Error(`--confirm-count must equal ${users.length}`);

  const detail =
    input.command === "credits:add-all"
      ? `, ${input.amount} créditos cada`
      : input.command === "plan:grant-all"
        ? `, plano ${input.plan}`
        : "";
  if (
    !(await input.confirm(
      `[${input.environment}] Você executará ${input.command} para ${users.length} usuários${detail}.`,
    ))
  )
    return { completed: 0, requested: users.length, skipped: 0 };

  let completed = 0;
  let skipped = 0;
  for (const target of users) {
    const idempotencyKey = getBulkTargetIdempotencyKey(input.rootKey, target.id);
    if (input.command === "credits:add-all") {
      await input.service.addCredits({
        amount: input.amount!,
        email: target.email,
        idempotencyKey,
        operatorId: input.operatorId,
        reason: input.reason,
      });
      completed += 1;
      continue;
    }
    if (input.command === "credits:reset-all") {
      await input.service.resetCredits({
        email: target.email,
        idempotencyKey,
        operatorId: input.operatorId,
        reason: input.reason,
      });
      completed += 1;
      continue;
    }
    const grant = await input.service.grantPlan({
      email: target.email,
      idempotencyKey,
      operatorId: input.operatorId,
      plan: input.plan!,
      reason: input.reason,
      skipIfAlreadyGranted: true,
    });
    if (grant?.result.alreadyGranted || grant?.result.replayed) skipped += 1;
    else completed += 1;
  }

  const result = { completed, requested: users.length, skipped };
  input.log(JSON.stringify(result, null, 2));
  return result;
};
