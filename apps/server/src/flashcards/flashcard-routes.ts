import {
  createFlashcardSchema,
  FLASHCARD_IMPORT_MAX_BYTES,
  flashcardBatchSchema,
  flashcardCollectionIdSchema,
  flashcardIdSchema,
  flashcardListQuerySchema,
  importFlashcardsSchema,
  updateFlashcardSchema,
} from "@lazuli/shared";
import type { FastifyPluginAsync } from "fastify";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import type { Database } from "../database/client.ts";
import { storeStudyImage } from "../documents/document-image-storage.ts";
import { createRequestRateLimiter } from "../security/request-rate-limiter.ts";
import { createMutationAuthorizer, sendValidationError } from "../routes/route-helpers.ts";
import { handleStudyImageUpload } from "../routes/study-image-upload.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";
import {
  batchFlashcards,
  createFlashcard,
  deleteFlashcard,
  getFlashcard,
  importFlashcards,
  listFlashcards,
  updateFlashcard,
} from "./flashcard-queries.ts";
import { FlashcardImportError, parseFlashcardImport } from "./flashcard-import.ts";

type Options = {
  auth: Auth;
  database: Database;
  storage: ObjectStorage;
  websiteUrl: string;
};

const errorName = (error: unknown) => (error instanceof Error ? error.name : "UnknownError");

const serializeCard = <
  T extends {
    archivedAt: Date | null;
    createdAt: Date;
    dueAt: Date;
    lastReviewedAt: Date | null;
    updatedAt: Date;
  },
>(
  card: T,
) => ({
  ...card,
  archivedAt: card.archivedAt?.toISOString() ?? null,
  createdAt: card.createdAt.toISOString(),
  dueAt: card.dueAt.toISOString(),
  lastReviewedAt: card.lastReviewedAt?.toISOString() ?? null,
  updatedAt: card.updatedAt.toISOString(),
});

const parseIds = (params: unknown) => {
  const raw = params as { collectionId?: unknown; cardId?: unknown };
  return {
    collectionId: flashcardCollectionIdSchema.safeParse(raw.collectionId),
    cardId: flashcardIdSchema.safeParse(raw.cardId),
  };
};

export const createFlashcardRoutes = ({
  auth,
  database,
  storage,
  websiteUrl,
}: Options): FastifyPluginAsync =>
  async function flashcardRoutes(app) {
    const limiter = createRequestRateLimiter({ limit: 120, windowMs: 10 * 60_000 });
    const authorizeMutation = createMutationAuthorizer(auth, websiteUrl, limiter);

    app.get("/api/flashcard-collections/:collectionId/cards", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const { collectionId } = parseIds(request.params);
      const input = flashcardListQuerySchema.safeParse(request.query);
      if (!collectionId.success || !input.success) return sendValidationError(reply);
      try {
        const result = await listFlashcards(
          database,
          session.user.id,
          collectionId.data,
          input.data,
        );
        if (!result)
          return reply.status(404).send({
            code: "COLLECTION_NOT_FOUND",
            message: "Esta coleção não foi encontrada.",
          });
        return { ...result, items: result.items.map(serializeCard) };
      } catch (error) {
        request.log.error(
          { errorName: errorName(error), userId: session.user.id },
          "flashcard list failed",
        );
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível carregar os flashcards.",
        });
      }
    });

    app.get("/api/flashcard-collections/:collectionId/cards/:cardId", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const { cardId, collectionId } = parseIds(request.params);
      if (!collectionId.success || !cardId.success) return sendValidationError(reply);
      const card = await getFlashcard(database, session.user.id, collectionId.data, cardId.data);
      if (!card)
        return reply.status(404).send({
          code: "FLASHCARD_NOT_FOUND",
          message: "Este flashcard não foi encontrado.",
        });
      return serializeCard(card);
    });

    app.post("/api/flashcard-collections/:collectionId/cards", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const { collectionId } = parseIds(request.params);
      const input = createFlashcardSchema.safeParse(request.body);
      if (!collectionId.success || !input.success) return sendValidationError(reply);
      const result = await createFlashcard(
        database,
        session.user.id,
        collectionId.data,
        input.data,
      );
      if (result.kind === "not-found")
        return reply
          .status(404)
          .send({ code: "COLLECTION_NOT_FOUND", message: "Esta coleção não foi encontrada." });
      if (result.kind === "invalid-assets")
        return reply
          .status(400)
          .send({ code: "INVALID_ASSETS", message: "Uma imagem não pertence a este flashcard." });
      if (result.kind === "conflict" || !result.card)
        return reply.status(409).send({
          code: "FLASHCARD_CREATE_CONFLICT",
          message: "Não foi possível concluir esta criação.",
        });
      return reply.status(result.created ? 201 : 200).send(serializeCard(result.card));
    });

    app.patch("/api/flashcard-collections/:collectionId/cards/:cardId", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const { cardId, collectionId } = parseIds(request.params);
      const input = updateFlashcardSchema.safeParse(request.body);
      if (!collectionId.success || !cardId.success || !input.success)
        return sendValidationError(reply);
      const result = await updateFlashcard(
        database,
        session.user.id,
        collectionId.data,
        cardId.data,
        input.data,
      );
      if (result.kind === "not-found")
        return reply
          .status(404)
          .send({ code: "FLASHCARD_NOT_FOUND", message: "Este flashcard não foi encontrado." });
      if (result.kind === "collection-not-found")
        return reply.status(400).send({
          code: "COLLECTION_NOT_FOUND",
          message: "A coleção escolhida não está disponível.",
        });
      if (result.kind === "invalid-assets")
        return reply
          .status(400)
          .send({ code: "INVALID_ASSETS", message: "Uma imagem não pertence a este flashcard." });
      return serializeCard(result.card!);
    });

    app.delete("/api/flashcard-collections/:collectionId/cards/:cardId", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const { cardId, collectionId } = parseIds(request.params);
      if (!collectionId.success || !cardId.success) return sendValidationError(reply);
      if (!(await deleteFlashcard(database, session.user.id, collectionId.data, cardId.data)))
        return reply
          .status(404)
          .send({ code: "FLASHCARD_NOT_FOUND", message: "Este flashcard não foi encontrado." });
      return reply.status(204).send();
    });

    app.post("/api/flashcard-collections/:collectionId/cards/batch", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const { collectionId } = parseIds(request.params);
      const input = flashcardBatchSchema.safeParse(request.body);
      if (!collectionId.success || !input.success) return sendValidationError(reply);
      const result = await batchFlashcards(
        database,
        session.user.id,
        collectionId.data,
        input.data,
      );
      if (result.kind === "not-found")
        return reply
          .status(404)
          .send({ code: "FLASHCARD_NOT_FOUND", message: "Um flashcard não foi encontrado." });
      if (result.kind === "collection-not-found")
        return reply.status(400).send({
          code: "COLLECTION_NOT_FOUND",
          message: "A coleção escolhida não está disponível.",
        });
      return reply.status(204).send();
    });

    app.post(
      "/api/flashcard-collections/:collectionId/cards/import/preview",
      async (request, reply) => {
        const session = await authorizeMutation(request, reply);
        if (!session) return;
        const { collectionId } = parseIds(request.params);
        if (!collectionId.success) return sendValidationError(reply);
        try {
          const part = await request.file({
            limits: { files: 1, fileSize: FLASHCARD_IMPORT_MAX_BYTES },
          });
          if (!part) return sendValidationError(reply);
          return parseFlashcardImport(part.filename, await part.toBuffer());
        } catch (error) {
          const tooLarge =
            error instanceof FlashcardImportError
              ? error.code === "TOO_LARGE"
              : typeof error === "object" &&
                error !== null &&
                "code" in error &&
                error.code === "FST_REQ_FILE_TOO_LARGE";
          if (tooLarge)
            return reply.status(413).send({
              code: "FLASHCARD_IMPORT_TOO_LARGE",
              message: "O arquivo deve ter no máximo 2 MB.",
            });
          if (error instanceof FlashcardImportError) {
            const messages = {
              INVALID_FILE: "Use um arquivo CSV, TSV ou TXT válido em UTF-8.",
              TOO_MANY_ROWS: "Importe no máximo 1.000 flashcards por vez.",
              NO_VALID_ROWS: "Nenhum par de pergunta e resposta foi encontrado.",
              TOO_LARGE: "O arquivo deve ter no máximo 2 MB.",
            } as const;
            return reply.status(422).send({
              code: `FLASHCARD_IMPORT_${error.code}`,
              message: messages[error.code],
            });
          }
          throw error;
        }
      },
    );

    app.post("/api/flashcard-collections/:collectionId/cards/import", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const { collectionId } = parseIds(request.params);
      const input = importFlashcardsSchema.safeParse(request.body);
      if (!collectionId.success || !input.success) return sendValidationError(reply);
      const result = await importFlashcards(
        database,
        session.user.id,
        collectionId.data,
        input.data,
      );
      if (result.kind === "not-found")
        return reply.status(404).send({
          code: "COLLECTION_NOT_FOUND",
          message: "Esta coleção não foi encontrada.",
        });
      if (result.kind === "conflict")
        return reply.status(409).send({
          code: "FLASHCARD_IMPORT_CONFLICT",
          message: "Não foi possível concluir esta importação.",
        });
      return reply.status(201).send({ imported: result.imported });
    });

    app.post("/api/flashcard-assets/images", async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      return handleStudyImageUpload({
        database,
        logMessage: "flashcard image upload failed",
        reply,
        request,
        storage,
        storeImage: (input) => storeStudyImage({ ...input, kind: "flashcards" }),
        userId: session.user.id,
      });
    });
  };
