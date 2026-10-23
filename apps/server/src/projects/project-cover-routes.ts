import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";
import { project, asset } from "../database/schema/index.ts";
import { createMutationAuthorizer, sendValidationError } from "../routes/route-helpers.ts";
import { createRequestRateLimiter } from "../security/request-rate-limiter.ts";
import { createAsset } from "../documents/document-queries.ts";
import {
  isImageUploadTooLargeError,
  StorageLimitReachedError,
} from "../documents/document-image-storage.ts";
import { enqueueObjectDeletions, releaseStoredObjects } from "../storage/storage-cleanup.ts";
import { sendCommercialLimitError } from "../commercial/commercial-limit-errors.ts";
import { getProject } from "./project-queries.ts";

const optionsSchema = z.object({
  uploadId: z.uuid(),
  expectedAssetId: z.string().default(""),
  expectedCoverKey: z.string().default(""),
  x: z.coerce.number().min(0).max(100).default(50),
  y: z.coerce.number().min(0).max(100).default(50),
  zoom: z.coerce.number().min(1).max(3).default(1),
});

export const prepareProjectCover = async (
  input: Buffer,
  options: { x: number; y: number; zoom: number },
) => {
  const type = await fileTypeFromBuffer(input);
  if (!type || !["image/jpeg", "image/png", "image/webp"].includes(type.mime))
    throw new Error("INVALID_COVER_IMAGE");
  const image = sharp(input, { limitInputPixels: 25_000_000, failOn: "warning", animated: false });
  const metadata = await image.metadata();
  if ((metadata.pages ?? 1) > 1) throw new Error("INVALID_COVER_IMAGE");
  const { width, height } = metadata.autoOrient;
  const cropWidth = Math.max(1, Math.floor(Math.min(width, (height * 16) / 9) / options.zoom));
  const cropHeight = Math.max(1, Math.floor((cropWidth * 9) / 16));
  const cropped = image.autoOrient().extract({
    left: Math.round(((width - cropWidth) * options.x) / 100),
    top: Math.round(((height - cropHeight) * options.y) / 100),
    width: cropWidth,
    height: cropHeight,
  });
  return Promise.all([
    cropped
      .clone()
      .resize({ width: 1600, height: 900, fit: "fill", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer(),
    cropped
      .clone()
      .resize({ width: 480, height: 270, fit: "fill", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer(),
  ]);
};

export const createProjectCoverRoutes =
  ({
    auth,
    database,
    storage,
    websiteUrl,
    enforceCommercialLimits,
  }: {
    auth: Auth;
    database: Database;
    storage: ObjectStorage;
    websiteUrl: string;
    enforceCommercialLimits: boolean;
  }): FastifyPluginAsync =>
  async (app) => {
    const authorize = createMutationAuthorizer(
      auth,
      websiteUrl,
      createRequestRateLimiter({ limit: 20, windowMs: 10 * 60_000 }),
    );
    app.post<{ Params: { projectId: string } }>(
      "/api/projects/:projectId/cover",
      async (request, reply) => {
        const current = await authorize(request, reply);
        if (!current) return;
        const projectId = z.uuid().safeParse(request.params.projectId);
        if (!projectId.success) return sendValidationError(reply);
        const owned = await getProject(database, current.user.id, projectId.data);
        if (!owned) return reply.status(404).send({ code: "PROJECT_NOT_FOUND" });
        let images: Buffer[];
        let options: z.infer<typeof optionsSchema>;
        try {
          const part = await request.file({
            limits: { files: 1, fileSize: 10 * 1024 * 1024, fields: 6 },
          });
          if (!part) return sendValidationError(reply);
          const input = await part.toBuffer();
          const fields = Object.fromEntries(
            Object.entries(part.fields).map(([key, value]) => [
              key,
              value && !Array.isArray(value) && value.type === "field" ? value.value : undefined,
            ]),
          );
          const parsed = optionsSchema.safeParse(fields);
          if (!parsed.success) return sendValidationError(reply);
          options = parsed.data;
          if (owned.coverAssetId === options.uploadId)
            return {
              ...owned,
              createdAt: owned.createdAt.toISOString(),
              updatedAt: owned.updatedAt.toISOString(),
            };
          images = await prepareProjectCover(input, options);
        } catch (error) {
          return reply.status(isImageUploadTooLargeError(error) ? 413 : 415).send({
            code: "INVALID_COVER_IMAGE",
            message: "Envie uma imagem JPEG, PNG ou WebP estática de até 10 MB e 25 megapixels.",
          });
        }
        const attemptId = crypto.randomUUID();
        const keys = ["main", "thumbnail"].map(
          (name) => `${current.user.id}/${projectId.data}/covers/${attemptId}/${name}.webp`,
        );
        await enqueueObjectDeletions(database, keys, 10 * 60_000);
        try {
          await Promise.all(
            images.map((image, index) => storage.put(keys[index]!, image, "image/webp")),
          );
          const result = await database.transaction(async (tx) => {
            const [latest] = await tx
              .select()
              .from(project)
              .where(and(eq(project.id, projectId.data), eq(project.userId, current.user.id)))
              .for("update");
            if (!latest) return "missing" as const;
            if (latest.coverAssetId === options.uploadId)
              return getProject(tx, current.user.id, latest.id);
            if (
              (latest.coverAssetId ?? "") !== options.expectedAssetId ||
              (latest.coverKey ?? "") !== options.expectedCoverKey
            )
              return "conflict" as const;
            const oldIds = [latest.coverAssetId, latest.coverThumbnailAssetId].filter(
              (id): id is string => Boolean(id),
            );
            if (oldIds.length) {
              const removed = await tx
                .delete(asset)
                .where(and(eq(asset.userId, current.user.id), inArray(asset.id, oldIds)))
                .returning();
              await releaseStoredObjects(tx, current.user.id, removed);
            }
            const ids = [options.uploadId, crypto.randomUUID()];
            for (const [index, image] of images.entries()) {
              const created = await createAsset(
                tx,
                {
                  id: ids[index]!,
                  userId: current.user.id,
                  projectId: latest.id,
                  objectKey: keys[index]!,
                  originalName: `capa-${index === 0 ? "principal" : "miniatura"}.webp`,
                  mimeType: "image/webp",
                  byteSize: image.length,
                  attachedAt: new Date(),
                },
                enforceCommercialLimits,
              );
              if (!created) throw new StorageLimitReachedError();
            }
            await tx
              .update(project)
              .set({
                coverKey: null,
                coverAssetId: ids[0],
                coverThumbnailAssetId: ids[1],
                updatedAt: new Date(),
              })
              .where(eq(project.id, latest.id));
            return getProject(tx, current.user.id, latest.id);
          });
          if (result === "missing") return reply.status(404).send({ code: "PROJECT_NOT_FOUND" });
          if (result === "conflict")
            return reply.status(409).send({
              code: "COVER_CHANGED",
              message: "A capa foi alterada em outra aba. Reabra este diálogo para continuar.",
            });
          if (!result) throw new Error("Project disappeared after cover update");
          return {
            ...result,
            createdAt: result.createdAt.toISOString(),
            updatedAt: result.updatedAt.toISOString(),
          };
        } catch (error) {
          if (error instanceof StorageLimitReachedError)
            return sendCommercialLimitError(
              reply,
              database,
              current.user.id,
              "PLAN_STORAGE_LIMIT_REACHED",
            );
          throw error;
        }
      },
    );
  };
