import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../database/client.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";

const dependencies = vi.hoisted(() => ({
  createAsset: vi.fn(),
  enqueueObjectDeletions: vi.fn(),
}));
vi.mock("./document-queries.ts", () => ({ createAsset: dependencies.createAsset }));
vi.mock("../storage/storage-cleanup.ts", () => ({
  enqueueObjectDeletions: dependencies.enqueueObjectDeletions,
}));

import {
  bufferedImageSource,
  storeDocumentImage,
  streamedImageSource,
} from "./document-image-storage.ts";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("streamedImageSource", () => {
  it("detects and replays an image without buffering the complete upload", async () => {
    const source = await streamedImageSource(Readable.from(png));
    const chunks: Buffer[] = [];
    for await (const chunk of source.body as Readable) chunks.push(Buffer.from(chunk));

    expect(source.detected?.mime).toBe("image/png");
    expect(Buffer.concat(chunks)).toEqual(png);
    expect(source.getByteSize()).toBe(png.byteLength);
  });

  it("does not schedule immediate object deletion after an asset has committed", async () => {
    dependencies.createAsset.mockResolvedValue({
      id: "invalid-response-id",
      mimeType: "image/png",
      byteSize: png.byteLength,
    });
    const storage = { put: vi.fn() } as unknown as ObjectStorage;

    await expect(
      storeDocumentImage({
        database: {} as Database,
        documentId: crypto.randomUUID(),
        originalName: "pixel.png",
        projectId: crypto.randomUUID(),
        source: await bufferedImageSource(png),
        storage,
        userId: "user-1",
      }),
    ).rejects.toBeDefined();

    expect(dependencies.enqueueObjectDeletions).toHaveBeenCalledOnce();
    expect(dependencies.enqueueObjectDeletions).toHaveBeenCalledWith(
      expect.anything(),
      [expect.any(String)],
      10 * 60_000,
    );
  });
});
