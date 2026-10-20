import { describe, expect, it, vi } from "vitest";

import {
  getBulkTargetIdempotencyKey,
  isBulkAdminCommand,
  runBulkAdminCommand,
} from "./commercial-admin-bulk.ts";

const users = [
  { email: "a@example.com", id: "user-a" },
  { email: "b@example.com", id: "user-b" },
];

const createService = () => ({
  addCredits: vi.fn(async () => null),
  grantPlan: vi.fn(
    async ({
      email,
    }: {
      email: string;
    }): Promise<{
      result: { alreadyGranted?: boolean; created?: boolean; replayed?: boolean };
    }> => ({
      result: email === "a@example.com" ? { alreadyGranted: true } : { created: true },
    }),
  ),
  listUsers: vi.fn(async () => users),
  recordDryRun: vi.fn(async () => null),
  resetCredits: vi.fn(async () => null),
});

describe("commercial bulk administration", () => {
  it("recognizes only supported bulk commands", () => {
    expect(isBulkAdminCommand("plan:grant-all")).toBe(true);
    expect(isBulkAdminCommand("credits:add-all")).toBe(true);
    expect(isBulkAdminCommand("plan:grant")).toBe(false);
  });

  it("uses a stable operation key per target user", () => {
    expect(getBulkTargetIdempotencyKey("rollout", "user-a")).toBe("rollout:user:user-a");
    expect(getBulkTargetIdempotencyKey("rollout", "user-b")).not.toBe(
      getBulkTargetIdempotencyKey("rollout", "user-a"),
    );
  });

  it("validates required command parameters before reading users", async () => {
    const service = createService();

    await expect(
      runBulkAdminCommand({
        command: "plan:grant-all",
        confirm: vi.fn(async () => true),
        environment: "test:billing-off",
        execute: false,
        log: vi.fn(),
        operatorId: "operator",
        reason: "rollout",
        rootKey: "operation",
        service,
      }),
    ).rejects.toThrow("plan is required for plan:grant-all");
    expect(service.listUsers).not.toHaveBeenCalled();
  });

  it("defaults to an audited dry-run without granting plans", async () => {
    const service = createService();
    const confirm = vi.fn(async () => true);

    const result = await runBulkAdminCommand({
      command: "plan:grant-all",
      confirm,
      environment: "test:billing-off",
      execute: false,
      log: vi.fn(),
      operatorId: "operator",
      plan: "specialist",
      reason: "rollout",
      rootKey: "operation",
      service,
    });

    expect(result).toEqual({ completed: 0, requested: 2, skipped: 0 });
    expect(service.recordDryRun).toHaveBeenCalledTimes(2);
    expect(service.recordDryRun).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "plan:grant-all.dry-run",
        idempotencyKey: "operation:dry-run",
        metadata: { plan: "specialist" },
      }),
    );
    expect(service.grantPlan).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("requires the exact user count before execution", async () => {
    const service = createService();

    await expect(
      runBulkAdminCommand({
        command: "plan:grant-all",
        confirm: vi.fn(async () => true),
        confirmCount: 1,
        environment: "production:billing-off",
        execute: true,
        log: vi.fn(),
        operatorId: "operator",
        plan: "specialist",
        reason: "rollout",
        rootKey: "operation",
        service,
      }),
    ).rejects.toThrow("--confirm-count must equal 2");
    expect(service.grantPlan).not.toHaveBeenCalled();
  });

  it("grants Specialist with target keys and reports existing grants as skipped", async () => {
    const service = createService();

    const result = await runBulkAdminCommand({
      command: "plan:grant-all",
      confirm: vi.fn(async () => true),
      confirmCount: 2,
      environment: "production:billing-off",
      execute: true,
      log: vi.fn(),
      operatorId: "operator",
      plan: "specialist",
      reason: "rollout",
      rootKey: "operation",
      service,
    });

    expect(result).toEqual({ completed: 1, requested: 2, skipped: 1 });
    expect(service.grantPlan).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        idempotencyKey: "operation:user:user-a",
        plan: "specialist",
        skipIfAlreadyGranted: true,
      }),
    );
    expect(service.grantPlan).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ idempotencyKey: "operation:user:user-b" }),
    );
  });

  it("reports an idempotently replayed grant as skipped", async () => {
    const service = createService();
    service.grantPlan.mockResolvedValue({ result: { created: true, replayed: true } });

    const result = await runBulkAdminCommand({
      command: "plan:grant-all",
      confirm: vi.fn(async () => true),
      confirmCount: 2,
      environment: "production:billing-off",
      execute: true,
      log: vi.fn(),
      operatorId: "operator",
      plan: "specialist",
      reason: "rollout",
      rootKey: "operation",
      service,
    });

    expect(result).toEqual({ completed: 0, requested: 2, skipped: 2 });
  });
});
