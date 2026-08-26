import {
  createQuizCollectionSchema,
  quizCollectionIdSchema,
  quizCollectionListQuerySchema,
  updateQuizCollectionSchema,
} from "@lazuli/shared";
import type { FastifyPluginAsync } from "fastify";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import type { Database } from "../database/client.ts";
import { createMutationAuthorizer, sendValidationError } from "../routes/route-helpers.ts";
import { createRequestRateLimiter } from "../security/request-rate-limiter.ts";
import {
  createQuizCollection,
  deleteQuizCollection,
  getQuizCollection,
  listQuizCollections,
  updateQuizCollection,
} from "./quiz-collection-queries.ts";

type QuizCollectionRoutesOptions = { auth: Auth; database: Database; websiteUrl: string };

const serializeCollection = <
  T extends {
    archivedAt: Date | null;
    createdAt: Date;
    lastAttemptAt: Date | null;
    updatedAt: Date;
  },
>(
  value: T,
) => ({
  ...value,
  archivedAt: value.archivedAt?.toISOString() ?? null,
  lastAttemptAt: value.lastAttemptAt?.toISOString() ?? null,
  createdAt: value.createdAt.toISOString(),
  updatedAt: value.updatedAt.toISOString(),
});

export const createQuizCollectionRoutes = ({
  auth,
  database,
  websiteUrl,
}: QuizCollectionRoutesOptions): FastifyPluginAsync =>
  async function quizCollectionRoutes(app) {
    const mutationLimiter = createRequestRateLimiter({ limit: 60, windowMs: 10 * 60 * 1_000 });
    const authorizeMutation = createMutationAuthorizer(auth, websiteUrl, mutationLimiter);

    app.get("/api/quiz-collections", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const query = quizCollectionListQuerySchema.safeParse(request.query);
      if (!query.success) return sendValidationError(reply);
      try {
        const result = await listQuizCollections(database, session.user.id, query.data);
        return { ...result, items: result.items.map(serializeCollection) };
      } catch (error) {
        request.log.error({ err: error, userId: session.user.id }, "quiz collections failed");
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível carregar suas coleções de quizzes.",
        });
      }
    });

    app.get("/api/quiz-collections/:collectionId", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const collectionId = quizCollectionIdSchema.safeParse(
        (request.params as { collectionId?: unknown }).collectionId,
      );
      if (!collectionId.success) return sendValidationError(reply);
      try {
        const collection = await getQuizCollection(database, session.user.id, collectionId.data);
        if (!collection)
          return reply.status(404).send({
            code: "COLLECTION_NOT_FOUND",
            message: "Esta coleção não foi encontrada.",
          });
        return serializeCollection(collection);
      } catch (error) {
        request.log.error(
          { collectionId: collectionId.data, err: error, userId: session.user.id },
          "quiz collection detail failed",
        );
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível carregar esta coleção.",
        });
      }
    });

    app.post("/api/quiz-collections", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const input = createQuizCollectionSchema.safeParse(request.body);
      if (!input.success) return sendValidationError(reply);
      try {
        const result = await createQuizCollection(database, session.user.id, input.data);
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
          "quiz collection creation completed",
        );
        return reply
          .status(result.created ? 201 : 200)
          .send(serializeCollection(result.collection));
      } catch (error) {
        request.log.error(
          { err: error, userId: session.user.id },
          "quiz collection creation failed",
        );
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível criar a coleção.",
        });
      }
    });

    app.patch("/api/quiz-collections/:collectionId", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const collectionId = quizCollectionIdSchema.safeParse(
        (request.params as { collectionId?: unknown }).collectionId,
      );
      const input = updateQuizCollectionSchema.safeParse(request.body);
      if (!collectionId.success || !input.success) return sendValidationError(reply);
      try {
        const result = await updateQuizCollection(
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
        return serializeCollection(result.collection);
      } catch (error) {
        request.log.error(
          { collectionId: collectionId.data, err: error, userId: session.user.id },
          "quiz collection update failed",
        );
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível atualizar a coleção.",
        });
      }
    });

    app.delete("/api/quiz-collections/:collectionId", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const collectionId = quizCollectionIdSchema.safeParse(
        (request.params as { collectionId?: unknown }).collectionId,
      );
      if (!collectionId.success) return sendValidationError(reply);
      try {
        const deleted = await deleteQuizCollection(database, session.user.id, collectionId.data);
        if (!deleted)
          return reply.status(404).send({
            code: "COLLECTION_NOT_FOUND",
            message: "Esta coleção não foi encontrada.",
          });
        return reply.status(204).send();
      } catch (error) {
        request.log.error(
          { collectionId: collectionId.data, err: error, userId: session.user.id },
          "quiz collection deletion failed",
        );
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível excluir a coleção.",
        });
      }
    });
  };
