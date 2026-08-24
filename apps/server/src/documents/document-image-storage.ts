import { assetResponseSchema, IMAGE_MAX_BYTES } from "@lazuli/shared";
import { fileTypeFromBuffer, fileTypeStream, type FileTypeResult } from "file-type";
import { Readable, Transform } from "node:stream";

import type { Database } from "../database/client.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";
import { enqueueObjectDeletions } from "../storage/storage-cleanup.ts";
import { createAsset } from "./document-queries.ts";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export class ImageUploadTooLargeError extends Error {}
export class StorageLimitReachedError extends Error {}

type ImageSource = {
  body: Uint8Array | Readable;
  detected: FileTypeResult | undefined;
  getByteSize: () => number;
  isTruncated?: () => boolean;
};

export const bufferedImageSource = async (buffer: Buffer): Promise<ImageSource> => ({
  body: buffer,
  detected: await fileTypeFromBuffer(buffer),
  getByteSize: () => buffer.byteLength,
});

export const streamedImageSource = async (stream: Readable): Promise<ImageSource> => {
  const detectedStream = await fileTypeStream(Readable.toWeb(stream));
  let byteSize = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      byteSize += chunk.byteLength;
      callback(null, chunk);
    },
  });
  const body = Readable.fromWeb(detectedStream).pipe(counter);
  return {
    body,
    detected: detectedStream.fileType,
    getByteSize: () => byteSize,
    isTruncated: () => Boolean((stream as Readable & { truncated?: boolean }).truncated),
  };
};

export const storeDocumentImage = async ({
  database,
  documentId,
  originalName,
  projectId,
  source,
  storage,
  userId,
}: {
  database: Database;
  documentId: string;
  originalName: string;
  projectId: string;
  source: ImageSource;
  storage: ObjectStorage;
  userId: string;
}) => {
  if (!source.detected || !imageTypes.has(source.detected.mime)) {
    if (source.body instanceof Readable) source.body.destroy();
    return null;
  }
  const id = crypto.randomUUID();
  const objectKey = `${userId}/${projectId}/${documentId}/${id}.${source.detected.ext}`;
  await enqueueObjectDeletions(database, [objectKey], 10 * 60_000);
  await storage.put(objectKey, source.body, source.detected.mime);
  if (source.isTruncated?.() || source.getByteSize() > IMAGE_MAX_BYTES) {
    await enqueueObjectDeletions(database, [objectKey]);
    throw new ImageUploadTooLargeError();
  }
  let committed = false;
  try {
    const created = await createAsset(database, {
      id,
      userId,
      projectId,
      documentId,
      objectKey,
      originalName: originalName.slice(0, 255),
      mimeType: source.detected.mime,
      byteSize: source.getByteSize(),
    });
    if (!created) throw new StorageLimitReachedError();
    committed = true;
    return assetResponseSchema.parse({
      id: created.id,
      url: `/api/assets/${created.id}/content`,
      mimeType: created.mimeType,
      byteSize: created.byteSize,
    });
  } catch (error) {
    if (!committed) await enqueueObjectDeletions(database, [objectKey]);
    throw error;
  }
};

export const filenameFromUrl = (url: URL) => {
  const encoded = url.pathname.split("/").pop() || "imagem";
  try {
    return decodeURIComponent(encoded);
  } catch {
    return "imagem";
  }
};
