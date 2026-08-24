import { IMAGE_MAX_BYTES, importDocumentImageSchema } from "@lazuli/shared";
import type { FastifyPluginAsync } from "fastify";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import { requireTrustedOrigin } from "../auth/require-trusted-origin.ts";
import type { Database } from "../database/client.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";
import {
  bufferedImageSource,
  filenameFromUrl,
  isImageUploadTooLargeError,
  StorageLimitReachedError,
  storeDocumentImage,
} from "./document-image-storage.ts";
import { documentValidationError, parseDocumentParams } from "./document-route-utils.ts";
import { deleteOwnedAsset, getDocument, getOwnedAsset } from "./document-queries.ts";
import { downloadRemoteImage, RemoteImageError } from "./remote-image.ts";

type Options = { auth: Auth; database: Database; storage: ObjectStorage; websiteUrl: string };

export const createDocumentAssetRoutes = ({
  auth,
  database,
  storage,
  websiteUrl,
}: Options): FastifyPluginAsync =>
  async function documentAssetRoutes(app) {
    app.post(
      "/api/projects/:projectId/documents/:documentId/assets/images",
      async (request, reply) => {
        if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
        const session = await requireSession(auth, request, reply);
        if (!session) return;
        const { projectId, documentId } = parseDocumentParams(request);
        if (!projectId.success || !documentId.success) return documentValidationError(reply);
        if (!(await getDocument(database, session.user.id, projectId.data, documentId.data)))
          return reply
            .status(404)
            .send({ code: "DOCUMENT_NOT_FOUND", message: "Este documento não foi encontrado." });

        let created: Awaited<ReturnType<typeof storeDocumentImage>>;
        try {
          const part = await request.file({ limits: { files: 1, fileSize: IMAGE_MAX_BYTES } });
          if (!part) return documentValidationError(reply);
          created = await storeDocumentImage({
            database,
            documentId: documentId.data,
            originalName: part.filename,
            projectId: projectId.data,
            source: await bufferedImageSource(await part.toBuffer()),
            storage,
            userId: session.user.id,
          });
        } catch (error) {
          if (isImageUploadTooLargeError(error))
            return reply.status(413).send({
              code: "IMAGE_TOO_LARGE",
              message: "A imagem deve ter no máximo 10 MB.",
            });
          if (error instanceof StorageLimitReachedError)
            return reply.status(409).send({
              code: "STORAGE_LIMIT_REACHED",
              message: "Seu limite de armazenamento foi atingido.",
            });
          request.log.error(
            { err: error, documentId: documentId.data, userId: session.user.id },
            "document image upload failed",
          );
          throw error;
        }
        if (!created)
          return reply.status(415).send({
            code: "UNSUPPORTED_IMAGE",
            message: "Envie uma imagem PNG, JPEG, WebP ou GIF.",
          });
        request.log.info(
          { assetId: created.id, documentId: documentId.data, userId: session.user.id },
          "document image uploaded",
        );
        return reply.status(201).send(created);
      },
    );

    app.post(
      "/api/projects/:projectId/documents/:documentId/assets/images/import",
      async (request, reply) => {
        if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
        const session = await requireSession(auth, request, reply);
        if (!session) return;
        const { projectId, documentId } = parseDocumentParams(request);
        const input = importDocumentImageSchema.safeParse(request.body);
        if (!projectId.success || !documentId.success || !input.success)
          return documentValidationError(reply);
        if (!(await getDocument(database, session.user.id, projectId.data, documentId.data)))
          return reply
            .status(404)
            .send({ code: "DOCUMENT_NOT_FOUND", message: "Este documento não foi encontrado." });

        let downloaded: Awaited<ReturnType<typeof downloadRemoteImage>>;
        try {
          downloaded = await downloadRemoteImage(input.data.url);
        } catch (error) {
          if (error instanceof RemoteImageError) {
            if (error.code === "TOO_LARGE")
              return reply.status(413).send({
                code: "IMAGE_TOO_LARGE",
                message: "A imagem deve ter no máximo 10 MB.",
              });
            if (error.code === "BLOCKED_ADDRESS" || error.code === "INVALID_URL")
              return reply.status(400).send({
                code: "REMOTE_IMAGE_URL_NOT_ALLOWED",
                message: "Essa origem de imagem não é permitida.",
              });
            if (error.code === "SOURCE_REJECTED")
              return reply.status(422).send({
                code: "REMOTE_IMAGE_SOURCE_REJECTED",
                message: "O site de origem bloqueou o download da imagem.",
              });
            return reply.status(422).send({
              code: "REMOTE_IMAGE_UNAVAILABLE",
              message: "Não foi possível importar essa imagem.",
            });
          }
          throw error;
        }

        const created = await storeDocumentImage({
          database,
          documentId: documentId.data,
          originalName: filenameFromUrl(downloaded.sourceUrl),
          projectId: projectId.data,
          source: await bufferedImageSource(downloaded.buffer),
          storage,
          userId: session.user.id,
        });
        if (!created)
          return reply.status(415).send({
            code: "UNSUPPORTED_IMAGE",
            message: "A URL não contém uma imagem PNG, JPEG, WebP ou GIF.",
          });
        request.log.info(
          { assetId: created.id, documentId: documentId.data, userId: session.user.id },
          "external document image imported",
        );
        return reply.status(201).send(created);
      },
    );

    app.get("/api/assets/:assetId/content", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const { assetId } = parseDocumentParams(request);
      if (!assetId.success) return documentValidationError(reply);
      const stored = await getOwnedAsset(database, session.user.id, assetId.data);
      if (!stored)
        return reply
          .status(404)
          .send({ code: "ASSET_NOT_FOUND", message: "Esta imagem não foi encontrada." });
      const object = await storage.get(stored.objectKey);
      reply
        .header("content-type", stored.mimeType)
        .header("cache-control", "private, max-age=3600")
        .header("x-content-type-options", "nosniff");
      return reply.send(object.Body);
    });

    app.delete("/api/assets/:assetId", async (request, reply) => {
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const { assetId } = parseDocumentParams(request);
      if (!assetId.success) return documentValidationError(reply);
      const stored = await getOwnedAsset(database, session.user.id, assetId.data);
      if (stored) {
        await deleteOwnedAsset(database, session.user.id, assetId.data);
        request.log.info({ assetId: stored.id, userId: session.user.id }, "document asset deleted");
      }
      return reply.status(204).send();
    });
  };
