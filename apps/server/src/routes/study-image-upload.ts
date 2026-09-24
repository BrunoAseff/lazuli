import { IMAGE_MAX_BYTES } from "@lazuli/shared";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { Database } from "../database/client.ts";
import {
  bufferedImageSource,
  isImageUploadTooLargeError,
  StorageLimitReachedError,
} from "../documents/document-image-storage.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";
import { sendValidationError } from "./route-helpers.ts";

type StoreImage = (input: {
  database: Database;
  originalName: string;
  source: Awaited<ReturnType<typeof bufferedImageSource>>;
  storage: ObjectStorage;
  userId: string;
}) => Promise<unknown>;

export const handleStudyImageUpload = async ({
  database,
  logMessage,
  reply,
  request,
  storage,
  storeImage,
  userId,
}: {
  database: Database;
  logMessage: string;
  reply: FastifyReply;
  request: FastifyRequest;
  storage: ObjectStorage;
  storeImage: StoreImage;
  userId: string;
}) => {
  try {
    const part = await request.file({ limits: { files: 1, fileSize: IMAGE_MAX_BYTES } });
    if (!part) return sendValidationError(reply);
    const created = await storeImage({
      database,
      originalName: part.filename,
      source: await bufferedImageSource(await part.toBuffer()),
      storage,
      userId,
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
    request.log.error(
      { errorName: error instanceof Error ? error.name : "UnknownError", userId },
      logMessage,
    );
    return reply
      .status(500)
      .send({ code: "INTERNAL_ERROR", message: "Não foi possível enviar a imagem." });
  }
};
