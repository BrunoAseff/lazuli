import {
  createStudyCollectionSchema,
  studyCollectionIdSchema,
  studyCollectionListQueryShape,
  updateStudyCollectionSchema,
  type CreateStudyCollectionInput,
  type UpdateStudyCollectionInput,
} from "@lazuli/shared";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import type { Database } from "../database/client.ts";
import {
  createMutationAuthorizer,
  sendInternalError,
  sendValidationError,
} from "../routes/route-helpers.ts";
import { createRequestRateLimiter } from "../security/request-rate-limiter.ts";

type CollectionRow = { id: string; archivedAt: Date | null; createdAt: Date; updatedAt: Date };
type ListQuery = z.infer<typeof listQuerySchema>;
const listQuerySchema = z.object(studyCollectionListQueryShape).strict();

/** The queries one kind of collection provides (flashcards and quizzes share the shape). */
export type StudyCollectionQueries<C extends CollectionRow> = {
  list: (
    database: Database,
    userId: string,
    input: ListQuery,
  ) => Promise<{ items: C[]; pagination: unknown }>;
  get: (database: Database, userId: string, collectionId: string) => Promise<C | null>;
  create: (
    database: Database,
    userId: string,
    input: CreateStudyCollectionInput,
  ) => Promise<
    | { kind: "project-not-found" }
    | { kind: "conflict" }
    | { kind: "ok"; created: boolean; collection: C | null | undefined }
  >;
  update: (
    database: Database,
    userId: string,
    collectionId: string,
    input: UpdateStudyCollectionInput,
  ) => Promise<
    { kind: "project-not-found" } | { kind: "not-found" } | { kind: "ok"; collection: C }
  >;
  remove: (database: Database, userId: string, collectionId: string) => Promise<unknown>;
};

/** Dates out as ISO strings; `nextPracticeAt` too when the kind has it (flashcards). */
const serializeCollection = <C extends CollectionRow>(value: C) => ({
  ...value,
  archivedAt: value.archivedAt?.toISOString() ?? null,
  createdAt: value.createdAt.toISOString(),
  updatedAt: value.updatedAt.toISOString(),
  ...("nextPracticeAt" in value
    ? { nextPracticeAt: (value.nextPracticeAt as Date | null)?.toISOString() ?? null }
    : {}),
});

const notFound = (reply: FastifyReply) =>
  reply
    .status(404)
    .send({ code: "COLLECTION_NOT_FOUND", message: "Esta coleção não foi encontrada." });

const projectNotFound = (reply: FastifyReply) =>
  reply
    .status(400)
    .send({ code: "PROJECT_NOT_FOUND", message: "O projeto escolhido não está disponível." });

const idOf = (params: unknown) =>
  studyCollectionIdSchema.safeParse((params as { collectionId?: unknown }).collectionId);

/**
 * The collection routes every study kind exposes (list, detail, create, rename/move/archive,
 * delete) under `/api/<path>`, with the kind's own queries and wording.
 */
export const createStudyCollectionRoutes =
  <C extends CollectionRow>({
    auth,
    database,
    kind,
    listFailedMessage,
    path,
    queries,
    websiteUrl,
  }: {
    auth: Auth;
    database: Database;
    /** Names the kind in logs ("flashcard", "quiz"). */
    kind: string;
    listFailedMessage: string;
    path: string;
    queries: StudyCollectionQueries<C>;
    websiteUrl: string;
  }): FastifyPluginAsync =>
  async (app) => {
    const mutationLimiter = createRequestRateLimiter({ limit: 60, windowMs: 10 * 60 * 1_000 });
    const authorizeMutation = createMutationAuthorizer(auth, websiteUrl, mutationLimiter);
    const base = `/api/${path}`;

    app.get(base, async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const query = listQuerySchema.safeParse(request.query);
      if (!query.success) return sendValidationError(reply);
      try {
        const result = await queries.list(database, session.user.id, query.data);
        return { ...result, items: result.items.map(serializeCollection) };
      } catch (error) {
        return sendInternalError(
          request,
          reply,
          listFailedMessage,
          { err: error, userId: session.user.id },
          `${kind} collections failed`,
        );
      }
    });

    app.get(`${base}/:collectionId`, async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const collectionId = idOf(request.params);
      if (!collectionId.success) return sendValidationError(reply);
      try {
        const collection = await queries.get(database, session.user.id, collectionId.data);
        if (!collection) return notFound(reply);
        return serializeCollection(collection);
      } catch (error) {
        return sendInternalError(
          request,
          reply,
          "Não foi possível carregar esta coleção.",
          { collectionId: collectionId.data, err: error, userId: session.user.id },
          `${kind} collection detail failed`,
        );
      }
    });

    app.post(base, async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const input = createStudyCollectionSchema.safeParse(request.body);
      if (!input.success) return sendValidationError(reply);
      try {
        const result = await queries.create(database, session.user.id, input.data);
        if (result.kind === "project-not-found") return projectNotFound(reply);
        if (result.kind === "conflict" || !result.collection)
          return reply.status(409).send({
            code: "COLLECTION_CREATE_CONFLICT",
            message: "Não foi possível concluir esta criação. Tente novamente.",
          });
        request.log.info(
          { collectionId: result.collection.id, created: result.created, userId: session.user.id },
          `${kind} collection creation completed`,
        );
        return reply
          .status(result.created ? 201 : 200)
          .send(serializeCollection(result.collection));
      } catch (error) {
        return sendInternalError(
          request,
          reply,
          "Não foi possível criar a coleção.",
          { err: error, userId: session.user.id },
          `${kind} collection creation failed`,
        );
      }
    });

    app.patch(`${base}/:collectionId`, async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const collectionId = idOf(request.params);
      const input = updateStudyCollectionSchema.safeParse(request.body);
      if (!collectionId.success || !input.success) return sendValidationError(reply);
      try {
        const result = await queries.update(
          database,
          session.user.id,
          collectionId.data,
          input.data,
        );
        if (result.kind === "project-not-found") return projectNotFound(reply);
        if (result.kind === "not-found") return notFound(reply);
        request.log.info(
          { collectionId: collectionId.data, userId: session.user.id },
          `${kind} collection updated`,
        );
        return serializeCollection(result.collection);
      } catch (error) {
        return sendInternalError(
          request,
          reply,
          "Não foi possível atualizar a coleção.",
          { collectionId: collectionId.data, err: error, userId: session.user.id },
          `${kind} collection update failed`,
        );
      }
    });

    app.delete(`${base}/:collectionId`, async (request, reply) => {
      const session = await authorizeMutation(request, reply);
      if (!session) return;
      const collectionId = idOf(request.params);
      if (!collectionId.success) return sendValidationError(reply);
      try {
        const deleted = await queries.remove(database, session.user.id, collectionId.data);
        if (!deleted) return notFound(reply);
        request.log.info(
          { collectionId: collectionId.data, userId: session.user.id },
          `${kind} collection deleted`,
        );
        return reply.status(204).send();
      } catch (error) {
        return sendInternalError(
          request,
          reply,
          "Não foi possível excluir a coleção.",
          { collectionId: collectionId.data, err: error, userId: session.user.id },
          `${kind} collection deletion failed`,
        );
      }
    });
  };
