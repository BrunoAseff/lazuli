import {
  createFlashcardPracticeSessionSchema,
  flashcardCollectionIdSchema,
  flashcardPracticeSessionIdSchema,
  submitFlashcardReviewSchema,
} from "@lazuli/shared";
import type { FastifyPluginAsync, FastifyReply } from "fastify";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import { requireTrustedOrigin } from "../auth/require-trusted-origin.ts";
import type { Database } from "../database/client.ts";
import { createRequestRateLimiter } from "../security/request-rate-limiter.ts";
import {
  abandonPracticeSession,
  createPracticeSession,
  getPracticeAvailability,
  getPracticeSession,
  submitPracticeReview,
} from "./flashcard-practice-queries.ts";

type Options = { auth: Auth; database: Database; websiteUrl: string };

const validationError = (reply: FastifyReply) =>
  reply.status(400).send({
    code: "VALIDATION_ERROR",
    message: "Revise os dados informados e tente novamente.",
  });

const serializeSession = (
  session: NonNullable<Awaited<ReturnType<typeof getPracticeSession>>>,
) => ({
  ...session,
  startedAt: session.startedAt.toISOString(),
  lastActivityAt: session.lastActivityAt.toISOString(),
  finishedAt: session.finishedAt?.toISOString() ?? null,
  currentItem: session.currentItem
    ? {
        ...session.currentItem,
        card: {
          ...session.currentItem.card,
          dueAt: session.currentItem.card.dueAt.toISOString(),
          lastReviewedAt: session.currentItem.card.lastReviewedAt?.toISOString() ?? null,
          archivedAt: session.currentItem.card.archivedAt?.toISOString() ?? null,
          createdAt: session.currentItem.card.createdAt.toISOString(),
          updatedAt: session.currentItem.card.updatedAt.toISOString(),
        },
        intervals: session.currentItem.intervals.map((interval) => ({
          ...interval,
          dueAt: interval.dueAt.toISOString(),
        })),
      }
    : null,
});

export const createFlashcardPracticeRoutes = ({
  auth,
  database,
  websiteUrl,
}: Options): FastifyPluginAsync =>
  async function flashcardPracticeRoutes(app) {
    const limiter = createRequestRateLimiter({ limit: 240, windowMs: 10 * 60_000 });
    const authorizeMutation = async (
      request: Parameters<typeof requireSession>[1],
      reply: FastifyReply,
    ) => {
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return null;
      const session = await requireSession(auth, request, reply);
      if (!session) return null;
      if (!limiter.consume(session.user.id)) {
        reply.status(429).send({
          code: "RATE_LIMITED",
          message: "Muitas revisões foram enviadas em pouco tempo. Aguarde e tente novamente.",
        });
        return null;
      }
      return session;
    };

    app.get("/api/flashcard-collections/:collectionId/practice", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const parsed = flashcardCollectionIdSchema.safeParse(
        (request.params as { collectionId?: unknown }).collectionId,
      );
      if (!parsed.success) return validationError(reply);
      const result = await getPracticeAvailability(database, session.user.id, parsed.data);
      if (result.kind === "not-found")
        return reply
          .status(404)
          .send({ code: "COLLECTION_NOT_FOUND", message: "Esta coleção não foi encontrada." });
      return {
        activeSession: result.activeSession ? serializeSession(result.activeSession) : null,
        newCards: result.newCards,
        dueCards: result.dueCards,
        totalAvailable: result.totalAvailable,
        archived: result.archived,
      };
    });

    app.post(
      "/api/flashcard-collections/:collectionId/practice-sessions",
      async (request, reply) => {
        const session = await authorizeMutation(request, reply);
        if (!session) return;
        const collectionId = flashcardCollectionIdSchema.safeParse(
          (request.params as { collectionId?: unknown }).collectionId,
        );
        const input = createFlashcardPracticeSessionSchema.safeParse(request.body);
        if (!collectionId.success || !input.success) return validationError(reply);
        const result = await createPracticeSession(
          database,
          session.user.id,
          collectionId.data,
          input.data,
        );
        if (result.kind === "not-found")
          return reply
            .status(404)
            .send({ code: "COLLECTION_NOT_FOUND", message: "Esta coleção não foi encontrada." });
        if (result.kind === "archived")
          return reply.status(409).send({
            code: "COLLECTION_ARCHIVED",
            message: "Restaure a coleção antes de praticar.",
          });
        if (result.kind === "empty")
          return reply.status(409).send({
            code: "NO_CARDS_AVAILABLE",
            message: "Não há flashcards disponíveis agora.",
          });
        if (result.kind === "conflict")
          return reply.status(409).send({
            code: "PRACTICE_SESSION_CONFLICT",
            message: "Não foi possível criar esta prática.",
          });
        if (result.kind === "active")
          return reply.status(409).send({
            code: "PRACTICE_SESSION_ACTIVE",
            message: "Já existe uma prática em andamento.",
            session: serializeSession(result.session!),
          });
        return reply.status(201).send(serializeSession(result.session!));
      },
    );

    app.get("/api/flashcard-practice-sessions/:sessionId", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const parsed = flashcardPracticeSessionIdSchema.safeParse(
        (request.params as { sessionId?: unknown }).sessionId,
      );
      if (!parsed.success) return validationError(reply);
      const result = await getPracticeSession(database, session.user.id, parsed.data);
      if (!result)
        return reply
          .status(404)
          .send({ code: "PRACTICE_SESSION_NOT_FOUND", message: "Esta prática não existe." });
      return serializeSession(result);
    });

    app.post("/api/flashcard-practice-sessions/:sessionId/reviews", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const sessionId = flashcardPracticeSessionIdSchema.safeParse(
        (request.params as { sessionId?: unknown }).sessionId,
      );
      const input = submitFlashcardReviewSchema.safeParse(request.body);
      if (!sessionId.success || !input.success) return validationError(reply);
      const result = await submitPracticeReview(
        database,
        session.user.id,
        sessionId.data,
        input.data,
      );
      if (result.kind === "not-found")
        return reply
          .status(404)
          .send({ code: "PRACTICE_SESSION_NOT_FOUND", message: "Esta prática não existe." });
      if (result.kind === "finished")
        return reply.status(409).send({
          code: "PRACTICE_SESSION_FINISHED",
          message: "Esta prática já foi encerrada.",
        });
      if (result.kind === "conflict")
        return reply.status(409).send({
          code: "REVIEW_CONFLICT",
          message: "Esta avaliação não corresponde à prática atual.",
        });
      return serializeSession(result.session!);
    });

    app.post("/api/flashcard-practice-sessions/:sessionId/abandon", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const parsed = flashcardPracticeSessionIdSchema.safeParse(
        (request.params as { sessionId?: unknown }).sessionId,
      );
      if (!parsed.success) return validationError(reply);
      if (!(await abandonPracticeSession(database, session.user.id, parsed.data)))
        return reply
          .status(404)
          .send({ code: "PRACTICE_SESSION_NOT_FOUND", message: "Esta prática não existe." });
      return reply.status(204).send();
    });
  };
