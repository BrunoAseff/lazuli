import {
  answerQuizAttemptItemSchema,
  createQuizAttemptSchema,
  createQuizQuestionSchema,
  IMAGE_MAX_BYTES,
  quizAttemptIdSchema,
  quizAttemptItemIdSchema,
  quizCollectionIdSchema,
  quizQuestionIdSchema,
  quizQuestionListQuerySchema,
  updateQuizQuestionSchema,
} from "@lazuli/shared";
import type { FastifyPluginAsync, FastifyReply } from "fastify";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import { requireTrustedOrigin } from "../auth/require-trusted-origin.ts";
import type { Database } from "../database/client.ts";
import {
  bufferedImageSource,
  isImageUploadTooLargeError,
  StorageLimitReachedError,
  storeQuizImage,
} from "../documents/document-image-storage.ts";
import { createRequestRateLimiter } from "../security/request-rate-limiter.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";
import {
  abandonQuizAttempt,
  answerQuizAttemptItem,
  completeQuizAttempt,
  createQuizAttempt,
  getQuizAttempt,
  getQuizAttemptAvailability,
} from "./quiz-attempt-queries.ts";
import {
  createQuizQuestion,
  deleteQuizQuestion,
  getQuizQuestion,
  listQuizQuestions,
  updateQuizQuestion,
} from "./quiz-question-queries.ts";

type Options = { auth: Auth; database: Database; storage: ObjectStorage; websiteUrl: string };
const validationError = (reply: FastifyReply) =>
  reply
    .status(400)
    .send({ code: "VALIDATION_ERROR", message: "Revise os dados informados e tente novamente." });
const serializeQuestion = <T extends { archivedAt: Date | null; createdAt: Date; updatedAt: Date }>(
  value: T,
) => ({
  ...value,
  archivedAt: value.archivedAt?.toISOString() ?? null,
  createdAt: value.createdAt.toISOString(),
  updatedAt: value.updatedAt.toISOString(),
});

export const createQuizRoutes =
  ({ auth, database, storage, websiteUrl }: Options): FastifyPluginAsync =>
  async (app) => {
    const limiter = createRequestRateLimiter({ limit: 160, windowMs: 10 * 60_000 });
    const mutationSession = async (
      request: Parameters<typeof requireSession>[1],
      reply: FastifyReply,
    ) => {
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return null;
      const session = await requireSession(auth, request, reply);
      if (!session) return null;
      if (!limiter.consume(session.user.id)) {
        reply.status(429).send({
          code: "RATE_LIMITED",
          message: "Muitas alterações foram feitas em pouco tempo. Aguarde e tente novamente.",
        });
        return null;
      }
      return session;
    };
    const parseQuestionParams = (params: unknown) => {
      const raw = params as { collectionId?: unknown; questionId?: unknown };
      return {
        collectionId: quizCollectionIdSchema.safeParse(raw.collectionId),
        questionId: quizQuestionIdSchema.safeParse(raw.questionId),
      };
    };
    const parseAttemptParams = (params: unknown) => {
      const raw = params as { attemptId?: unknown; itemId?: unknown };
      return {
        attemptId: quizAttemptIdSchema.safeParse(raw.attemptId),
        itemId: quizAttemptItemIdSchema.safeParse(raw.itemId),
      };
    };

    app.get("/api/quiz-collections/:collectionId/questions", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const { collectionId } = parseQuestionParams(request.params);
      const input = quizQuestionListQuerySchema.safeParse(request.query);
      if (!collectionId.success || !input.success) return validationError(reply);
      const result = await listQuizQuestions(
        database,
        session.user.id,
        collectionId.data,
        input.data,
      );
      if (!result)
        return reply
          .status(404)
          .send({ code: "COLLECTION_NOT_FOUND", message: "Esta coleção não foi encontrada." });
      return { ...result, items: result.items.map(serializeQuestion) };
    });
    app.get("/api/quiz-collections/:collectionId/questions/:questionId", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const { collectionId, questionId } = parseQuestionParams(request.params);
      if (!collectionId.success || !questionId.success) return validationError(reply);
      const question = await getQuizQuestion(
        database,
        session.user.id,
        collectionId.data,
        questionId.data,
      );
      return question
        ? serializeQuestion(question)
        : reply
            .status(404)
            .send({ code: "QUESTION_NOT_FOUND", message: "Esta questão não foi encontrada." });
    });
    app.post("/api/quiz-collections/:collectionId/questions", async (request, reply) => {
      const session = await mutationSession(request, reply);
      if (!session) return;
      const { collectionId } = parseQuestionParams(request.params);
      const input = createQuizQuestionSchema.safeParse(request.body);
      if (!collectionId.success || !input.success) return validationError(reply);
      const result = await createQuizQuestion(
        database,
        session.user.id,
        collectionId.data,
        input.data,
      );
      if (result.kind === "not-found")
        return reply
          .status(404)
          .send({ code: "COLLECTION_NOT_FOUND", message: "Esta coleção não está disponível." });
      if (result.kind === "invalid-assets")
        return reply
          .status(400)
          .send({ code: "INVALID_ASSETS", message: "Uma imagem não pertence a esta questão." });
      if (result.kind === "conflict" || !result.question)
        return reply.status(409).send({
          code: "QUESTION_CREATE_CONFLICT",
          message: "Não foi possível concluir esta criação.",
        });
      return reply.status(result.created ? 201 : 200).send(serializeQuestion(result.question));
    });
    app.patch(
      "/api/quiz-collections/:collectionId/questions/:questionId",
      async (request, reply) => {
        const session = await mutationSession(request, reply);
        if (!session) return;
        const { collectionId, questionId } = parseQuestionParams(request.params);
        const input = updateQuizQuestionSchema.safeParse(request.body);
        if (!collectionId.success || !questionId.success || !input.success)
          return validationError(reply);
        const result = await updateQuizQuestion(
          database,
          session.user.id,
          collectionId.data,
          questionId.data,
          input.data,
        );
        if (result.kind === "not-found")
          return reply
            .status(404)
            .send({ code: "QUESTION_NOT_FOUND", message: "Esta questão não foi encontrada." });
        if (result.kind === "collection-not-found")
          return reply.status(400).send({
            code: "COLLECTION_NOT_FOUND",
            message: "A coleção escolhida não está disponível.",
          });
        if (result.kind === "invalid-assets")
          return reply
            .status(400)
            .send({ code: "INVALID_ASSETS", message: "Uma imagem não pertence a esta questão." });
        return serializeQuestion(result.question!);
      },
    );
    app.delete(
      "/api/quiz-collections/:collectionId/questions/:questionId",
      async (request, reply) => {
        const session = await mutationSession(request, reply);
        if (!session) return;
        const { collectionId, questionId } = parseQuestionParams(request.params);
        if (!collectionId.success || !questionId.success) return validationError(reply);
        if (
          !(await deleteQuizQuestion(database, session.user.id, collectionId.data, questionId.data))
        )
          return reply
            .status(404)
            .send({ code: "QUESTION_NOT_FOUND", message: "Esta questão não foi encontrada." });
        return reply.status(204).send();
      },
    );
    app.get("/api/quiz-collections/:collectionId/attempt", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const { collectionId } = parseQuestionParams(request.params);
      if (!collectionId.success) return validationError(reply);
      const result = await getQuizAttemptAvailability(database, session.user.id, collectionId.data);
      return (
        result ??
        reply
          .status(404)
          .send({ code: "COLLECTION_NOT_FOUND", message: "Esta coleção não foi encontrada." })
      );
    });
    app.post("/api/quiz-collections/:collectionId/attempts", async (request, reply) => {
      const session = await mutationSession(request, reply);
      if (!session) return;
      const { collectionId } = parseQuestionParams(request.params);
      const input = createQuizAttemptSchema.safeParse(request.body);
      if (!collectionId.success || !input.success) return validationError(reply);
      const result = await createQuizAttempt(
        database,
        session.user.id,
        collectionId.data,
        input.data,
      );
      if (result.kind === "active-exists")
        return reply.status(409).send({
          code: "ACTIVE_ATTEMPT_EXISTS",
          message: "Continue ou abandone a tentativa atual.",
        });
      if (result.kind === "empty")
        return reply
          .status(409)
          .send({ code: "EMPTY_QUIZ", message: "Crie ao menos uma questão antes de iniciar." });
      if (result.kind === "too-large")
        return reply.status(409).send({
          code: "QUIZ_TOO_LARGE",
          message: "Este quiz deve ter no máximo 200 questões por tentativa.",
        });
      if (result.kind === "invalid")
        return reply.status(409).send({
          code: "INVALID_QUIZ",
          message: "Revise as questões e alternativas antes de iniciar.",
        });
      if (result.kind !== "ok" || !result.attempt)
        return reply
          .status(result.kind === "not-found" ? 404 : 409)
          .send({ code: "QUIZ_START_FAILED", message: "Não foi possível iniciar o quiz." });
      return reply.status(201).send(result.attempt);
    });
    app.get("/api/quiz-attempts/:attemptId", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const { attemptId } = parseAttemptParams(request.params);
      if (!attemptId.success) return validationError(reply);
      const attempt = await getQuizAttempt(database, session.user.id, attemptId.data);
      return (
        attempt ??
        reply
          .status(404)
          .send({ code: "ATTEMPT_NOT_FOUND", message: "Esta tentativa não foi encontrada." })
      );
    });
    app.put("/api/quiz-attempts/:attemptId/items/:itemId/answer", async (request, reply) => {
      const session = await mutationSession(request, reply);
      if (!session) return;
      const { attemptId, itemId } = parseAttemptParams(request.params);
      const input = answerQuizAttemptItemSchema.safeParse(request.body);
      if (!attemptId.success || !itemId.success || !input.success) return validationError(reply);
      const result = await answerQuizAttemptItem(
        database,
        session.user.id,
        attemptId.data,
        itemId.data,
        input.data,
      );
      if (result.kind === "invalid-option") return validationError(reply);
      if (result.kind !== "ok")
        return reply
          .status(result.kind === "not-found" ? 404 : 409)
          .send({ code: "ATTEMPT_NOT_ACTIVE", message: "Esta tentativa não está mais ativa." });
      return result.attempt;
    });
    app.post("/api/quiz-attempts/:attemptId/complete", async (request, reply) => {
      const session = await mutationSession(request, reply);
      if (!session) return;
      const { attemptId } = parseAttemptParams(request.params);
      if (!attemptId.success) return validationError(reply);
      const result = await completeQuizAttempt(database, session.user.id, attemptId.data);
      if (result.kind === "incomplete")
        return reply.status(409).send({
          code: "INCOMPLETE_ATTEMPT",
          message: "Responda todas as questões antes de concluir.",
        });
      if (result.kind !== "ok")
        return reply
          .status(result.kind === "not-found" ? 404 : 409)
          .send({ code: "ATTEMPT_NOT_ACTIVE", message: "Esta tentativa não está disponível." });
      return result.attempt;
    });
    app.post("/api/quiz-attempts/:attemptId/abandon", async (request, reply) => {
      const session = await mutationSession(request, reply);
      if (!session) return;
      const { attemptId } = parseAttemptParams(request.params);
      if (!attemptId.success) return validationError(reply);
      if (!(await abandonQuizAttempt(database, session.user.id, attemptId.data)))
        return reply
          .status(404)
          .send({ code: "ATTEMPT_NOT_FOUND", message: "Esta tentativa não foi encontrada." });
      return reply.status(204).send();
    });
    app.post("/api/quiz-assets/images", async (request, reply) => {
      const session = await mutationSession(request, reply);
      if (!session) return;
      try {
        const part = await request.file({ limits: { files: 1, fileSize: IMAGE_MAX_BYTES } });
        if (!part) return validationError(reply);
        const created = await storeQuizImage({
          database,
          originalName: part.filename,
          source: await bufferedImageSource(await part.toBuffer()),
          storage,
          userId: session.user.id,
        });
        if (!created)
          return reply.status(415).send({
            code: "UNSUPPORTED_IMAGE",
            message: "Envie uma imagem PNG, JPEG, WebP ou GIF.",
          });
        return reply.status(201).send(created);
      } catch (error) {
        if (isImageUploadTooLargeError(error))
          return reply
            .status(413)
            .send({ code: "IMAGE_TOO_LARGE", message: "A imagem deve ter no máximo 10 MB." });
        if (error instanceof StorageLimitReachedError)
          return reply.status(409).send({
            code: "STORAGE_LIMIT_REACHED",
            message: "Seu limite de armazenamento foi atingido.",
          });
        request.log.error({ err: error, userId: session.user.id }, "quiz image upload failed");
        return reply
          .status(500)
          .send({ code: "INTERNAL_ERROR", message: "Não foi possível enviar a imagem." });
      }
    });
  };
