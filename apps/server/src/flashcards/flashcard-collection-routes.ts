import {
  createFlashcardCollectionSchema,
  flashcardCollectionIdSchema,
  flashcardCollectionListQuerySchema,
  updateFlashcardCollectionSchema,
} from "@lazuli/shared";
import type { FastifyPluginAsync, FastifyReply } from "fastify";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import { requireTrustedOrigin } from "../auth/require-trusted-origin.ts";
import type { Database } from "../database/client.ts";
import { createRequestRateLimiter } from "../security/request-rate-limiter.ts";
import {
  createFlashcardCollection,
  deleteFlashcardCollection,
  getFlashcardCollection,
  listFlashcardCollections,
  updateFlashcardCollection,
} from "./flashcard-collection-queries.ts";

type FlashcardCollectionRoutesOptions = { auth: Auth; database: Database; websiteUrl: string };

const sendValidationError = (reply: FastifyReply) =>
  reply.status(400).send({
    code: "VALIDATION_ERROR",
    message: "Revise os dados informados e tente novamente.",
  });
const serializeCollection = <
  T extends {
    archivedAt: Date | null;
    createdAt: Date;
    lastReviewedAt: Date | null;
    nextPracticeAt: Date | null;
    updatedAt: Date;
  },
>(
  value: T,
) => ({
  ...value,
  archivedAt: value.archivedAt?.toISOString() ?? null,
  nextPracticeAt: value.nextPracticeAt?.toISOString() ?? null,
  lastReviewedAt: value.lastReviewedAt?.toISOString() ?? null,
  createdAt: value.createdAt.toISOString(),
  updatedAt: value.updatedAt.toISOString(),
});

export const createFlashcardCollectionRoutes = ({
  auth,
  database,
  websiteUrl,
}: FlashcardCollectionRoutesOptions): FastifyPluginAsync =>
  async function flashcardCollectionRoutes(app) {
    const mutationLimiter = createRequestRateLimiter({ limit: 60, windowMs: 10 * 60 * 1_000 });
    const authorizeMutation = async (
      request: Parameters<typeof requireSession>[1],
      reply: FastifyReply,
    ) => {
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return null;
      const session = await requireSession(auth, request, reply);
      if (!session) return null;
      if (!mutationLimiter.consume(session.user.id)) {
        reply.status(429).send({
          code: "RATE_LIMITED",
          message: "Muitas alterações foram feitas em pouco tempo. Aguarde e tente novamente.",
        });
        return null;
      }
      return session;
    };

    app.get("/api/flashcard-collections", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const query = flashcardCollectionListQuerySchema.safeParse(request.query);
      if (!query.success) return sendValidationError(reply);
      try {
        const result = await listFlashcardCollections(database, session.user.id, query.data);
        return { ...result, items: result.items.map(serializeCollection) };
      } catch (error) {
        request.log.error({ err: error, userId: session.user.id }, "flashcard collections failed");
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível carregar suas coleções.",
        });
      }
    });

    app.get("/api/flashcard-collections/:collectionId", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const collectionId = flashcardCollectionIdSchema.safeParse(
        (request.params as { collectionId?: unknown }).collectionId,
      );
      if (!collectionId.success) return sendValidationError(reply);
      try {
        const collection = await getFlashcardCollection(
          database,
          session.user.id,
          collectionId.data,
        );
        if (!collection)
          return reply.status(404).send({
            code: "COLLECTION_NOT_FOUND",
            message: "Esta coleção não foi encontrada.",
          });
        return serializeCollection(collection);
      } catch (error) {
        request.log.error(
          { collectionId: collectionId.data, err: error, userId: session.user.id },
          "flashcard collection detail failed",
        );
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível carregar esta coleção.",
        });
      }
    });

    app.post("/api/flashcard-collections", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const input = createFlashcardCollectionSchema.safeParse(request.body);
      if (!input.success) return sendValidationError(reply);
      try {
        const result = await createFlashcardCollection(database, session.user.id, input.data);
        if (result.kind === "project-not-found")
          return reply.status(400).send({
            code: "PROJECT_NOT_FOUND",
            message: "O projeto escolhido não está disponível.",
          });
        if (result.kind === "conflict" || !result.collection)
          return reply.status(409).send({
            code: "COLLECTION_CREATE_CONFLICT",
            message: "Não foi possível concluir esta criação. Tente novamente.",
          });
        request.log.info(
          { collectionId: result.collection.id, created: result.created, userId: session.user.id },
          "flashcard collection creation completed",
        );
        return reply
          .status(result.created ? 201 : 200)
          .send(serializeCollection(result.collection));
      } catch (error) {
        request.log.error({ err: error, userId: session.user.id }, "collection creation failed");
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível criar a coleção.",
        });
      }
    });

    app.patch("/api/flashcard-collections/:collectionId", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const collectionId = flashcardCollectionIdSchema.safeParse(
        (request.params as { collectionId?: unknown }).collectionId,
      );
      const input = updateFlashcardCollectionSchema.safeParse(request.body);
      if (!collectionId.success || !input.success) return sendValidationError(reply);
      try {
        const result = await updateFlashcardCollection(
          database,
          session.user.id,
          collectionId.data,
          input.data,
        );
        if (result.kind === "project-not-found")
          return reply.status(400).send({
            code: "PROJECT_NOT_FOUND",
            message: "O projeto escolhido não está disponível.",
          });
        if (result.kind === "not-found")
          return reply.status(404).send({
            code: "COLLECTION_NOT_FOUND",
            message: "Esta coleção não foi encontrada.",
          });
        request.log.info(
          { collectionId: collectionId.data, userId: session.user.id },
          "flashcard collection updated",
        );
        return serializeCollection(result.collection);
      } catch (error) {
        request.log.error(
          { collectionId: collectionId.data, err: error, userId: session.user.id },
          "collection update failed",
        );
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível atualizar a coleção.",
        });
      }
    });

    app.delete("/api/flashcard-collections/:collectionId", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const collectionId = flashcardCollectionIdSchema.safeParse(
        (request.params as { collectionId?: unknown }).collectionId,
      );
      if (!collectionId.success) return sendValidationError(reply);
      try {
        const deleted = await deleteFlashcardCollection(
          database,
          session.user.id,
          collectionId.data,
        );
        if (!deleted)
          return reply.status(404).send({
            code: "COLLECTION_NOT_FOUND",
            message: "Esta coleção não foi encontrada.",
          });
        request.log.info(
          { collectionId: collectionId.data, userId: session.user.id },
          "flashcard collection deleted",
        );
        return reply.status(204).send();
      } catch (error) {
        request.log.error(
          { collectionId: collectionId.data, err: error, userId: session.user.id },
          "collection deletion failed",
        );
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível excluir a coleção.",
        });
      }
    });
  };
