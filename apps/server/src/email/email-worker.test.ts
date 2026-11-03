import { expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { Database } from "../database/client.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";
import type { ServerEnv } from "../config.ts";
import type { FastifyBaseLogger } from "fastify";
import { createLifecycleEmailWorker } from "./email-worker.ts";

it("recovers interrupted signups without requiring a legal acceptance row", async () => {
  const execute = vi.fn().mockResolvedValue([]);
  const query = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn((count: number) => (count === 1 ? { for: async () => [] } : Promise.resolve([]))),
  };
  query.from.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  const database = {
    execute,
    select: () => query,
    transaction: (operation: (tx: { select: () => typeof query }) => unknown) =>
      operation({ select: () => query }),
  } as unknown as Database;
  const logger = { error: vi.fn() } as unknown as FastifyBaseLogger;
  await createLifecycleEmailWorker(
    database,
    {} as ObjectStorage,
    {} as ServerEnv,
    logger,
    vi.fn(),
  ).run();
  const recovery = new PgDialect().sqlToQuery(execute.mock.calls[0]![0]).sql;
  expect(recovery).toContain("email_rollout");
  expect(recovery).toContain("not exists (select 1 from email_outbox");
  expect(recovery).not.toContain("legal_acceptance");
  expect(recovery).toContain("on conflict (deduplication_key) do nothing");
  expect(logger.error).not.toHaveBeenCalled();
});
