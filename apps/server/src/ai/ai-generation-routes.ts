import {
  aiGenerationIdSchema,
  approveAiSelectionGenerationSchema,
  createAiSelectionGenerationSchema,
} from "@lazuli/shared";
import type { FastifyPluginAsync } from "fastify";

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
  prepareAiSelectionGeneration,
} from "./ai-selection-queries.ts";

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
      if (prepared.kind === "conflict" || prepared.kind === "source-changed")
        return reply
          .status(409)
          .send({ code: "AI_SOURCE_CHANGED", message: "O trecho mudou. Selecione-o novamente." });
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
          return reply.status(409).send({
            code: "AI_SOURCE_CHANGED",
            message: "A imagem mudou. Selecione-a novamente.",
          });
        const result = await service.generateSelectionDraft({
          ...input.data,
          blocks: prepared.blocks,
          documentRevision: prepared.documentRevision,
          images:
            prepared.imageAsset && imageBytes
              ? [{ data: imageBytes, mediaType: prepared.imageAsset.mimeType }]
              : undefined,
          selectedText: prepared.selectedText,
          sourceBlockIds: prepared.sourceBlockIds,
          userId: session.user.id,
        });
        return reply
          .status(result.kind === "completed" ? 201 : 202)
          .send(serializeGeneration(result));
      } catch (error) {
        return sendAiError(reply, error);
      }
    });

    app.get("/api/ai/generations/:operationId", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const operationId = operationIdFrom(request.params);
      if (!operationId.success) return sendValidationError(reply);
      try {
        const result = await service.getSelectionDraft(session.user.id, operationId.data);
        if (!result)
          return reply
            .status(404)
            .send({ code: "AI_GENERATION_NOT_FOUND", message: "Esta geração não foi encontrada." });
        return serializeGeneration(result);
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
      if (result.kind === "conflict" || result.kind === "source-changed")
        return reply.status(409).send({
          code: "AI_SOURCE_CHANGED",
          message: "O documento mudou. Selecione o trecho novamente.",
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
