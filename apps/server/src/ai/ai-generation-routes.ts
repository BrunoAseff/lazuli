import {
  aiGenerationIdSchema,
  applyAiMaterialImprovementSchema,
  approveAiSelectionGenerationSchema,
  createAiCollectionGenerationSchema,
  createAiMaterialImprovementSchema,
  createAiSelectionGenerationSchema,
} from "@lazuli/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import type { Database } from "../database/client.ts";
import { createMutationAuthorizer, sendValidationError } from "../routes/route-helpers.ts";
import { createRequestRateLimiter } from "../security/request-rate-limiter.ts";
import { AiGenerationError } from "./ai-errors.ts";
import type { AiGenerationService } from "./ai-generation-service.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";
import {
  approveAiSelectionGeneration,
  getAiDocumentSourceMetadata,
  prepareAiCollectionGeneration,
  prepareAiSelectionGeneration,
} from "./ai-selection-queries.ts";
import {
  applyAiMaterialImprovement,
  prepareAiMaterialImprovement,
} from "./ai-material-improvement-queries.ts";

const operationIdFrom = (params: unknown) =>
  aiGenerationIdSchema.safeParse((params as { operationId?: unknown }).operationId);

const sendAiError = (reply: Parameters<typeof sendValidationError>[0], error: unknown) => {
  if (!(error instanceof AiGenerationError)) throw error;
  const status =
    error.code === "AI_INSUFFICIENT_CREDITS"
      ? 402
      : error.code === "AI_RATE_LIMITED" || error.code === "AI_CONCURRENCY_LIMITED"
        ? 429
        : error.code === "AI_CONFIGURATION_ERROR"
          ? 503
          : 422;
  return reply.status(status).send({ code: error.code, message: error.message });
};

const serializeGeneration = (
  result: Awaited<ReturnType<AiGenerationService["generateSelectionDraft"]>>,
) =>
  result.kind === "in-progress"
    ? { status: "running" as const, operationId: result.operationId }
    : { status: "completed" as const, draft: result.draft };

const serializeCollectionGeneration = (
  result: Awaited<ReturnType<AiGenerationService["getCollectionDraft"]>>,
) => {
  if (!result) return null;
  return result.kind === "completed"
    ? { status: "completed" as const, draft: result.draft }
    : { status: result.kind, operationId: result.operationId };
};

const enrichStoredDraftSource = async <
  T extends { draft: { documentId: string; projectId: string | null } },
>(
  database: Database,
  userId: string,
  result: T,
) => {
  if (result.draft.projectId) return result;
  const source = await getAiDocumentSourceMetadata(database, userId, result.draft.documentId);
  return source ? { ...result, draft: { ...result.draft, ...source } } : result;
};

export const createAiGenerationRoutes = ({
  auth,
  database,
  service,
  storage,
  websiteUrl,
}: {
  auth: Auth;
  database: Database;
  service: AiGenerationService;
  storage: ObjectStorage;
  websiteUrl: string;
}): FastifyPluginAsync =>
  async function aiGenerationRoutes(app) {
    const limiter = createRequestRateLimiter({ limit: 30, windowMs: 10 * 60_000 });
    const authorizeMutation = createMutationAuthorizer(auth, websiteUrl, limiter);

    app.post("/api/ai/selection-generations", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const input = createAiSelectionGenerationSchema.safeParse(request.body);
      if (!input.success) return sendValidationError(reply);
      const prepared = await prepareAiSelectionGeneration(database, session.user.id, input.data);
      if (prepared.kind === "not-found" || prepared.kind === "collection-not-found")
        return reply
          .status(404)
          .send({ code: "AI_SOURCE_NOT_FOUND", message: "A fonte ou coleção não foi encontrada." });
      if (prepared.kind === "source-too-large")
        return reply.status(422).send({
          code: "AI_INPUT_TOO_LARGE",
          message: "Este documento é grande demais para uma única geração. Selecione um trecho.",
        });
      try {
        const storedImage = prepared.imageAsset
          ? await storage.get(prepared.imageAsset.objectKey)
          : null;
        const imageBytes = storedImage?.Body
          ? await storedImage.Body.transformToByteArray()
          : undefined;
        if (prepared.imageAsset && !imageBytes)
          return reply.status(404).send({
            code: "AI_SOURCE_NOT_FOUND",
            message: "A imagem selecionada não foi encontrada.",
          });
        const result = await service.generateSelectionDraft({
          ...input.data,
          blocks: prepared.blocks,
          context: prepared.context,
          documentTitle: prepared.documentTitle,
          documentRevision: prepared.documentRevision,
          images:
            prepared.imageAsset && imageBytes
              ? [{ data: imageBytes, mediaType: prepared.imageAsset.mimeType }]
              : undefined,
          selectedText: prepared.selectedText,
          projectId: prepared.projectId,
          projectTitle: prepared.projectTitle,
          sourceBlockIds: prepared.sourceBlockIds,
          userId: session.user.id,
        });
        const response = serializeGeneration(result);
        return reply
          .status(result.kind === "completed" ? 201 : 202)
          .send(
            response.status === "completed"
              ? await enrichStoredDraftSource(database, session.user.id, response)
              : response,
          );
      } catch (error) {
        return sendAiError(reply, error);
      }
    });

    app.post("/api/ai/material-improvements", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const input = createAiMaterialImprovementSchema.safeParse(request.body);
      if (!input.success) return sendValidationError(reply);
      const prepared = await prepareAiMaterialImprovement(database, session.user.id, input.data);
      if (prepared.kind === "not-found")
        return reply.status(404).send({
          code: "AI_SOURCE_NOT_FOUND",
          message: "Este material não foi encontrado.",
        });
      const references = prepared.references.map((reference) => ({
        id: reference.id,
        documentId: reference.documentId,
        documentTitle: reference.documentTitle,
        projectId: reference.projectId,
        projectTitle: reference.projectTitle,
        anchorId: reference.anchorId,
        sourcePreview: reference.sourcePreview,
      }));
      const sources = references
        .slice(0, 3)
        .flatMap((reference) =>
          reference.sourcePreview ? [{ id: reference.id, text: reference.sourcePreview }] : [],
        );
      const material = prepared.material;
      const current =
        input.data.kind === "flashcard" && "question" in material
          ? {
              question: material.question,
              answer: material.answer,
              questionText: material.questionText,
              answerText: material.answerText,
            }
          : "content" in material
            ? {
                content: material.content,
                prompt: material.contentText,
                options: material.options,
                correctOptionIndex: material.options.findIndex(({ isCorrect }) => isCorrect),
              }
            : null;
      if (!current) return sendValidationError(reply);
      const promptCurrent =
        input.data.kind === "flashcard" && "questionText" in material
          ? { question: material.questionText, answer: material.answerText }
          : "contentText" in material
            ? {
                prompt: material.contentText,
                options: material.options.map(({ text }) => text),
                correctOptionIndex: material.options.findIndex(({ isCorrect }) => isCorrect),
              }
            : null;
      if (!promptCurrent) return sendValidationError(reply);
      try {
        const result = await service.generateMaterialImprovementDraft({
          ...input.data,
          current,
          promptCurrent,
          materialUpdatedAt: material.updatedAt.toISOString(),
          references,
          sources,
          userId: session.user.id,
        });
        return reply
          .status(result.kind === "completed" ? 201 : 202)
          .send(
            result.kind === "completed"
              ? { status: "completed", draft: result.draft }
              : { status: "running", operationId: result.operationId },
          );
      } catch (error) {
        return sendAiError(reply, error);
      }
    });

    app.get("/api/ai/material-improvements/:operationId", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const operationId = operationIdFrom(request.params);
      if (!operationId.success) return sendValidationError(reply);
      try {
        const result = await service.getMaterialImprovementDraft(session.user.id, operationId.data);
        if (!result)
          return reply.status(404).send({
            code: "AI_GENERATION_NOT_FOUND",
            message: "Esta melhoria não foi encontrada.",
          });
        return result.kind === "completed"
          ? { status: "completed", draft: result.draft }
          : { status: "running", operationId: result.operationId };
      } catch (error) {
        return sendAiError(reply, error);
      }
    });

    app.post("/api/ai/material-improvements/:operationId/apply", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const operationId = operationIdFrom(request.params);
      const input = applyAiMaterialImprovementSchema.safeParse(request.body);
      if (!operationId.success || !input.success) return sendValidationError(reply);
      const result = await applyAiMaterialImprovement(
        database,
        session.user.id,
        operationId.data,
        input.data,
      );
      if (result.kind === "not-found")
        return reply.status(404).send({
          code: "AI_GENERATION_NOT_FOUND",
          message: "Esta melhoria não foi encontrada.",
        });
      if (result.kind === "already-approved")
        return reply.status(409).send({
          code: "AI_GENERATION_APPROVED",
          message: "Esta melhoria já foi aplicada.",
        });
      if (result.kind === "expired")
        return reply.status(410).send({
          code: "AI_GENERATION_EXPIRED",
          message: "Esta proposta expirou.",
        });
      if (result.kind === "invalid-assets")
        return reply.status(422).send({
          code: "AI_INVALID_OUTPUT",
          message: "A melhoria aceita apenas o conteúdo textual gerado nesta etapa.",
        });
      if (result.kind === "invalid") return sendValidationError(reply);
      return { materialId: result.materialId, updatedAt: result.updatedAt };
    });

    app.delete("/api/ai/material-improvements/:operationId", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const operationId = operationIdFrom(request.params);
      if (!operationId.success) return sendValidationError(reply);
      const discarded = await service.discardMaterialImprovementDraft(
        session.user.id,
        operationId.data,
      );
      if (!discarded)
        return reply.status(404).send({
          code: "AI_GENERATION_NOT_FOUND",
          message: "Esta melhoria não foi encontrada.",
        });
      return reply.status(204).send();
    });

    app.post("/api/ai/collection-generations", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const input = createAiCollectionGenerationSchema.safeParse(request.body);
      if (!input.success) return sendValidationError(reply);
      const prepared = await prepareAiCollectionGeneration(database, session.user.id, input.data);
      if (prepared.kind === "not-found" || prepared.kind === "collection-not-found")
        return reply
          .status(404)
          .send({ code: "AI_SOURCE_NOT_FOUND", message: "A fonte ou coleção não foi encontrada." });
      if (prepared.kind === "source-too-large")
        return reply.status(422).send({
          code: "AI_INPUT_TOO_LARGE",
          message: "Este documento é grande demais. Escolha uma seção menor.",
        });
      try {
        const result = await service.enqueueCollectionDraft({
          ...input.data,
          documentTitle: prepared.documentTitle,
          documentRevision: prepared.documentRevision,
          projectId: prepared.projectId,
          projectTitle: prepared.projectTitle,
          sourceScope: input.data.sourceBlockIds.length ? "section" : "document",
          userId: session.user.id,
        });
        const response =
          result.kind === "completed"
            ? { status: "completed" as const, draft: result.draft }
            : { status: result.kind, operationId: result.operationId };
        return reply
          .status(result.kind === "completed" ? 201 : 202)
          .send(
            response.status === "completed"
              ? await enrichStoredDraftSource(database, session.user.id, response)
              : response,
          );
      } catch (error) {
        return sendAiError(reply, error);
      }
    });

    app.get("/api/ai/collection-generations/latest", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const collectionId = collectionIdFrom(request.query);
      if (!collectionId.success) return sendValidationError(reply);
      try {
        const result = await service.getLatestCollectionDraft(session.user.id, collectionId.data);
        if (!result) return { status: "none" as const };
        const response = serializeCollectionGeneration(result);
        return response?.status === "completed"
          ? enrichStoredDraftSource(database, session.user.id, response)
          : response;
      } catch (error) {
        return sendAiError(reply, error);
      }
    });

    app.delete("/api/ai/collection-generations/:operationId", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const operationId = operationIdFrom(request.params);
      if (!operationId.success) return sendValidationError(reply);
      const discarded = await service.discardCollectionDraft(session.user.id, operationId.data);
      if (!discarded)
        return reply.status(404).send({
          code: "AI_GENERATION_NOT_FOUND",
          message: "Este rascunho não foi encontrado.",
        });
      return reply.status(204).send();
    });

    app.get("/api/ai/generations/:operationId", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const operationId = operationIdFrom(request.params);
      if (!operationId.success) return sendValidationError(reply);
      try {
        const result =
          (await service.getSelectionDraft(session.user.id, operationId.data)) ??
          (await service.getCollectionDraft(session.user.id, operationId.data));
        if (!result)
          return reply
            .status(404)
            .send({ code: "AI_GENERATION_NOT_FOUND", message: "Esta geração não foi encontrada." });
        if (result.kind === "completed")
          return enrichStoredDraftSource(database, session.user.id, {
            status: "completed" as const,
            draft: result.draft,
          });
        return result.kind === "in-progress"
          ? { status: "running" as const, operationId: result.operationId }
          : { status: result.kind, operationId: result.operationId };
      } catch (error) {
        return sendAiError(reply, error);
      }
    });

    app.post("/api/ai/generations/:operationId/approve", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const operationId = operationIdFrom(request.params);
      const input = approveAiSelectionGenerationSchema.safeParse(request.body);
      if (!operationId.success || !input.success) return sendValidationError(reply);
      const result = await approveAiSelectionGeneration(
        database,
        session.user.id,
        operationId.data,
        input.data,
      );
      if (result.kind === "not-found")
        return reply
          .status(404)
          .send({ code: "AI_GENERATION_NOT_FOUND", message: "Esta geração não foi encontrada." });
      if (result.kind === "already-approved")
        return reply
          .status(409)
          .send({ code: "AI_GENERATION_APPROVED", message: "Esta geração já foi salva." });
      if (result.kind === "expired")
        return reply
          .status(410)
          .send({ code: "AI_GENERATION_EXPIRED", message: "Este rascunho expirou." });
      if (result.kind === "reference-unanchorable")
        return reply.status(409).send({
          code: "AI_REFERENCE_UNANCHORABLE",
          message:
            "Não foi possível vincular uma referência ao trecho escolhido. Ajuste a referência e tente novamente.",
          itemId: result.itemId,
        });
      if (result.kind === "collection-not-found")
        return reply
          .status(404)
          .send({ code: "COLLECTION_NOT_FOUND", message: "A coleção não foi encontrada." });
      if (result.kind === "quota")
        return reply
          .status(409)
          .send({ code: "STORAGE_LIMIT", message: "O limite de armazenamento foi atingido." });
      if (result.kind === "invalid-items") return sendValidationError(reply);
      return { createdIds: result.createdIds, revision: result.revision };
    });
  };
const collectionIdFrom = (query: unknown) =>
  z.uuid().safeParse((query as { collectionId?: unknown }).collectionId);
