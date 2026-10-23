import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { prepareProjectCover } from "./project-cover-routes.ts";

describe("project cover processing", () => {
  it("rejects text disguised as an image", async () => {
    await expect(
      prepareProjectCover(Buffer.from("not a JPEG"), { x: 50, y: 50, zoom: 1 }),
    ).rejects.toThrow("INVALID_COVER_IMAGE");
  });
  it("produces bounded main and thumbnail WebP images without EXIF", async () => {
    const source = await sharp({
      create: { width: 2000, height: 1500, channels: 3, background: "#007bb8" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const outputs = await prepareProjectCover(source, { x: 0, y: 100, zoom: 2 });
    const [main, thumbnail] = await Promise.all(outputs.map((buffer) => sharp(buffer).metadata()));
    expect(main.format).toBe("webp");
    expect(main.width).toBeLessThanOrEqual(1600);
    expect(main.exif).toBeUndefined();
    expect(thumbnail.width).toBeLessThanOrEqual(480);
    expect(thumbnail.height).toBeLessThanOrEqual(270);
  });
});
