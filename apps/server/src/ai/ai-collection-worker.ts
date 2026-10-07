import { and, asc, eq, isNull, lt, lte, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { Database } from "../database/client.ts";
import { aiGeneration } from "../database/schema/index.ts";
import { AiGenerationError } from "./ai-errors.ts";
import type { AiGenerationService, CollectionGenerationJob } from "./ai-generation-service.ts";
import { prepareAiCollectionGeneration } from "./ai-selection-queries.ts";

// A collection generation may make two provider requests before settling.
// Keep an abandoned lease long enough that another worker cannot claim it mid-request.
const LEASE_MS = 5 * 60_000;
const MAX_CLAIM_ATTEMPTS = 3;
const POLL_MS = 750;

const readJob = (result: unknown): CollectionGenerationJob | null => {
  if (!result || typeof result !== "object" || !("job" in result)) return null;
  return (result as { job: CollectionGenerationJob }).job;
};

export const hasExceededCollectionClaimAttempts = (attempts: number) =>
  attempts > MAX_CLAIM_ATTEMPTS;

const claimNext = (db: Database, workerId: string) =>
  db.transaction(async (tx) => {
    const now = new Date();
    const [candidate] = await tx
      .select()
      .from(aiGeneration)
      .where(
        and(
          eq(aiGeneration.type, "collection_generation"),
          eq(aiGeneration.status, "running"),
          lte(aiGeneration.availableAt, now),
          or(isNull(aiGeneration.leasedUntil), lt(aiGeneration.leasedUntil, now)),
        ),
      )
      .orderBy(asc(aiGeneration.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!candidate) return null;
    const [claimed] = await tx
      .update(aiGeneration)
      .set({
        attempts: candidate.attempts + 1,
        leaseOwner: workerId,
        leasedUntil: new Date(now.getTime() + LEASE_MS),
        startedAt: now,
      })
      .where(and(eq(aiGeneration.id, candidate.id), eq(aiGeneration.status, "running")))
      .returning();
    return claimed ?? null;
  });

export const createAiCollectionWorker = (
  db: Database,
  service: AiGenerationService,
  logger: { error: (value: unknown, message: string) => void },
) => {
  const workerId = `ai-collection:${process.pid}:${randomUUID()}`;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = true;

  const schedule = () => {
    if (stopped || timer) return;
    timer = setTimeout(() => {
      timer = null;
      void run();
    }, POLL_MS);
  };
  const run = async () => {
    let claimed: Awaited<ReturnType<typeof claimNext>> = null;
    let generationStarted = false;
    const settleFailure = async (error: unknown) => {
      if (!claimed) return;
      try {
        await service.failCollectionDraft(claimed.userId, claimed.id, error);
      } catch (settlementError) {
        logger.error(
          { err: settlementError, operationId: claimed.id, workerId },
          "AI collection worker could not settle failed claim",
        );
      }
    };
    try {
      claimed = await claimNext(db, workerId);
      if (!claimed) return;
      if (hasExceededCollectionClaimAttempts(claimed.attempts)) {
        await settleFailure(new AiGenerationError("AI_REQUEST_FAILED"));
        return;
      }
      const job = readJob(claimed.result);
      if (!job) throw new AiGenerationError("AI_REQUEST_FAILED");
      if (claimed.cancelRequestedAt) throw new AiGenerationError("AI_REQUEST_FAILED");
      const prepared = await prepareAiCollectionGeneration(db, claimed.userId, {
        ...job,
        expectedRevision: job.documentRevision,
        idempotencyKey: claimed.idempotencyKey,
      });
      if (prepared.kind === "source-too-large") throw new AiGenerationError("AI_INPUT_TOO_LARGE");
      if (prepared.kind !== "ok") throw new AiGenerationError("AI_REQUEST_FAILED");
      generationStarted = true;
      await service.processCollectionDraft({
        blocks: prepared.blocks,
        job,
        operationId: claimed.id,
        userId: claimed.userId,
      });
    } catch (error) {
      // processCollectionDraft owns provider retries and final settlement. Errors
      // raised before that boundary still need to release the reservation here.
      if (claimed && !generationStarted) await settleFailure(error);
      logger.error({ err: error, workerId }, "AI collection worker iteration failed");
    } finally {
      schedule();
    }
  };

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      void run();
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
};
