import {
  createDocumentImportSchema,
  DOCUMENT_IMPORT_BINARY_MAX_BYTES,
  documentImportListSchema,
  documentImportSchema,
  documentImportStatusSchema,
  projectIdSchema,
  projectItemIdSchema,
} from "@lazuli/shared";
import { fileTypeStream } from "file-type";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { Readable, Transform } from "node:stream";
import { z } from "zod";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import { requireTrustedOrigin } from "../auth/require-trusted-origin.ts";
import type { Database } from "../database/client.ts";
import { storageObjectDeletion } from "../database/schema/index.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";
import { enqueueObjectDeletions } from "../storage/storage-cleanup.ts";
import {
  cancelDocumentImport,
  clearImportObjectKey,
  createDocumentImport,
  getOwnedDocumentImport,
  getStorageUsage,
  listDocumentImports,
  markImportQueued,
  retryDocumentImport,
} from "./document-import-queries.ts";

type Options = { auth: Auth; database: Database; storage: ObjectStorage; websiteUrl: string };
const paramsSchema = z.object({ projectId: projectIdSchema, importId: projectItemIdSchema });
const importIdParamsSchema = z.object({ importId: projectItemIdSchema });

const serializeImport = (item: Awaited<ReturnType<typeof getOwnedDocumentImport>>) => {
  if (!item) return null;
  return documentImportSchema.parse({
    id: item.id,
    projectId: item.projectId,
    parentId: item.parentId,
    documentId: item.documentId,
    originalName: item.originalName,
    mimeType: item.detectedMimeType ?? item.declaredMimeType,
    byteSize: item.inputByteSize,
    status: documentImportStatusSchema.parse(item.status),
    phase: item.phase,
    progressCurrent: item.progressCurrent,
    progressTotal: item.progressTotal,
    errorCode: item.errorCode,
    warnings: item.warnings,
    resultDocumentId: item.resultDocumentId,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    finishedAt: item.finishedAt?.toISOString() ?? null,
  });
};

const detectImportMime = (detectedMime: string | undefined, declared: string, filename: string) => {
  if (declared === "application/pdf") return detectedMime === "application/pdf" ? declared : null;
  if (declared.includes("wordprocessingml")) {
    return detectedMime === "application/zip" && filename.toLowerCase().endsWith(".docx")
      ? declared
      : null;
  }
  if (declared === "text/markdown" || declared === "text/plain") {
    return detectedMime ? null : declared;
  }
  return null;
};

export const createDocumentImportRoutes = ({
  auth,
  database,
  storage,
  websiteUrl,
}: Options): FastifyPluginAsync =>
  async function documentImportRoutes(app) {
    app.post("/api/projects/:projectId/document-imports", async (request, reply) => {
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const projectId = projectIdSchema.safeParse(
        (request.params as { projectId?: unknown }).projectId,
      );
      const input = createDocumentImportSchema.safeParse(request.body);
      if (!projectId.success || !input.success)
        return reply
          .status(400)
          .send({ code: "VALIDATION_ERROR", message: "Revise o arquivo escolhido." });
      const result = await createDocumentImport(
        database,
        session.user.id,
        projectId.data,
        input.data,
      );
      if (result.kind === "not-found")
        return reply
          .status(404)
          .send({ code: "PROJECT_NOT_FOUND", message: "Este projeto não foi encontrado." });
      if (result.kind === "invalid-parent")
        return reply
          .status(400)
          .send({ code: "INVALID_PARENT", message: "Escolha uma pasta válida." });
      if (result.kind === "quota")
        return reply.status(409).send({
          code: "STORAGE_LIMIT_REACHED",
          message: "Seu limite de armazenamento foi atingido.",
        });
      if (result.kind === "too-many")
        return reply.status(429).send({
          code: "TOO_MANY_IMPORTS",
          message: "Aguarde uma importação em andamento terminar.",
        });
      if (result.kind === "rate-limited")
        return reply.status(429).send({
          code: "IMPORT_RATE_LIMITED",
          message: "Muitas importações foram iniciadas recentemente. Aguarde alguns minutos.",
        });
      if (result.kind === "conflict")
        return reply
          .status(409)
          .send({ code: "IMPORT_CONFLICT", message: "Não foi possível iniciar esta importação." });
      return reply.status(result.kind === "created" ? 201 : 200).send(serializeImport(result.item));
    });

    app.put(
      "/api/projects/:projectId/document-imports/:importId/file",
      { bodyLimit: DOCUMENT_IMPORT_BINARY_MAX_BYTES + 1024 * 1024 },
      async (request, reply) => {
        if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
        const session = await requireSession(auth, request, reply);
        if (!session) return;
        const params = paramsSchema.safeParse(request.params);
        if (!params.success)
          return reply
            .status(400)
            .send({ code: "VALIDATION_ERROR", message: "Importação inválida." });
        const job = await getOwnedDocumentImport(database, session.user.id, params.data.importId);
        if (!job || job.projectId !== params.data.projectId)
          return reply
            .status(404)
            .send({ code: "IMPORT_NOT_FOUND", message: "Esta importação não foi encontrada." });
        if (job.status !== "uploading") return serializeImport(job);
        const part = await request.file({ limits: { fileSize: job.inputByteSize, files: 1 } });
        if (!part)
          return reply
            .status(400)
            .send({ code: "FILE_REQUIRED", message: "Escolha um arquivo para importar." });
        const detectedStream = await fileTypeStream(Readable.toWeb(part.file));
        const detectedMimeType = detectImportMime(
          detectedStream.fileType?.mime,
          job.declaredMimeType,
          job.originalName,
        );
        if (!detectedMimeType) {
          await detectedStream.cancel();
          await cancelDocumentImport(database, session.user.id, job.id);
          return reply.status(415).send({
            code: "UNSUPPORTED_FILE_TYPE",
            message: "O conteúdo do arquivo não corresponde ao formato informado.",
          });
        }
        const objectKey = `imports/${session.user.id}/${job.id}/${crypto.randomUUID()}`;
        let byteSize = 0;
        const counter = new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            byteSize += chunk.byteLength;
            callback(null, chunk);
          },
        });
        const body = Readable.fromWeb(detectedStream).pipe(counter);
        try {
          await enqueueObjectDeletions(database, [objectKey], 10 * 60_000);
          await storage.put(objectKey, body, detectedMimeType, job.inputByteSize);
          if (part.file.truncated || byteSize !== job.inputByteSize) {
            await enqueueObjectDeletions(database, [objectKey]);
            await cancelDocumentImport(database, session.user.id, job.id);
            return reply.status(400).send({
              code: "INVALID_FILE_SIZE",
              message: "O tamanho do arquivo não corresponde ao envio iniciado.",
            });
          }
          const queued = await markImportQueued(
            database,
            session.user.id,
            job.id,
            objectKey,
            detectedMimeType,
          );
          if (!queued) {
            await enqueueObjectDeletions(database, [objectKey]);
            return reply
              .status(409)
              .send({ code: "IMPORT_STATE_CONFLICT", message: "Esta importação já foi alterada." });
          }
          await database
            .delete(storageObjectDeletion)
            .where(eq(storageObjectDeletion.objectKey, objectKey));
          return serializeImport(queued);
        } catch (error) {
          request.log.error({ err: error, importId: job.id }, "document import upload failed");
          await enqueueObjectDeletions(database, [objectKey]).catch(() => undefined);
          return reply.status(503).send({
            code: "STORAGE_UNAVAILABLE",
            message: "Não foi possível enviar o arquivo. Tente novamente.",
          });
        }
      },
    );

    app.get("/api/document-imports", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const imports = await listDocumentImports(database, session.user.id);
      return documentImportListSchema.parse({ imports: imports.map(serializeImport) });
    });

    app.post("/api/document-imports/:importId/cancel", async (request, reply) => {
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const params = importIdParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(400).send({ code: "VALIDATION_ERROR" });
      const before = await getOwnedDocumentImport(database, session.user.id, params.data.importId);
      const item = await cancelDocumentImport(database, session.user.id, params.data.importId);
      if (item?.status === "canceled" && before?.inputObjectKey) {
        try {
          await storage.delete(before.inputObjectKey);
          await clearImportObjectKey(database, item.id, before.inputObjectKey);
        } catch (error) {
          request.log.warn({ err: error, importId: item.id }, "canceled import cleanup deferred");
        }
      }
      return item ? serializeImport(item) : reply.status(404).send({ code: "IMPORT_NOT_FOUND" });
    });

    app.post("/api/document-imports/:importId/retry", async (request, reply) => {
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const params = importIdParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(400).send({ code: "VALIDATION_ERROR" });
      const result = await retryDocumentImport(database, session.user.id, params.data.importId);
      if (!result)
        return reply.status(409).send({
          code: "IMPORT_NOT_RETRYABLE",
          message: "Esta importação não pode ser repetida.",
        });
      if (result.kind === "quota")
        return reply.status(409).send({
          code: "STORAGE_LIMIT_REACHED",
          message: "Seu limite de armazenamento foi atingido.",
        });
      return serializeImport(result.item);
    });

    app.get("/api/storage/usage", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      return getStorageUsage(database, session.user.id);
    });
  };
