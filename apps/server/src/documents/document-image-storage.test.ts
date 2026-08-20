import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";

import { streamedImageSource } from "./document-image-storage.ts";

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
});
