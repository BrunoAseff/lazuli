import { describe, expect, it, vi } from "vitest";

import type { LazuliDocumentBlock } from "./document-schema.tsx";
import { importExternalImages } from "./import-external-images.ts";

const image = (id: string, url: string) =>
  ({
    id,
    type: "image",
    props: { url },
    content: undefined,
    children: [],
  }) as unknown as LazuliDocumentBlock[number];
const imageUrl = (block: LazuliDocumentBlock[number] | undefined) =>
  (block?.props as { url?: string } | undefined)?.url;

describe("external document image import", () => {
  it("imports each external URL once and keeps internal assets", async () => {
    const external = "https://example.com/image.png";
    const local = "/api/assets/00000000-0000-4000-8000-000000000001/content";
    const importImage = vi.fn().mockResolvedValue(local);
    const content = [
      image("one", external),
      image("two", external),
      image("three", "/api/assets/00000000-0000-4000-8000-000000000002/content"),
    ] as LazuliDocumentBlock;

    const result = await importExternalImages({
      content,
      importImage,
      removeImage: vi.fn(),
    });

    expect(importImage).toHaveBeenCalledOnce();
    expect(result.importedAssetUrls).toEqual([local]);
    expect(imageUrl(result.content[0])).toBe(local);
    expect(imageUrl(result.content[1])).toBe(local);
    expect(imageUrl(result.content[2])).toContain("00000000-0000-4000-8000-000000000002");
    expect(imageUrl(content[0])).toBe(external);
  });

  it("removes assets created by an incomplete import", async () => {
    const removeImage = vi.fn().mockResolvedValue(undefined);
    const content = [
      image("one", "https://example.com/one.png"),
      image("two", "https://example.com/two.png"),
    ] as LazuliDocumentBlock;
    const importImage = vi.fn(async (url: string) => {
      if (url.endsWith("one.png")) {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return "/api/assets/00000000-0000-4000-8000-000000000001/content";
      }
      throw new Error("download failed");
    });

    await expect(importExternalImages({ content, importImage, removeImage })).rejects.toMatchObject(
      {
        blockId: "two",
        sourceUrl: "https://example.com/two.png",
      },
    );
    expect(removeImage).toHaveBeenCalledWith(
      "/api/assets/00000000-0000-4000-8000-000000000001/content",
    );
  });

  it("reports a partial asset that could not be cleaned", async () => {
    const local = "/api/assets/00000000-0000-4000-8000-000000000001/content";
    const content = [
      image("one", "https://example.com/one.png"),
      image("two", "https://example.com/two.png"),
    ] as LazuliDocumentBlock;
    const importImage = vi.fn(async (url: string) => {
      if (url.endsWith("one.png")) return local;
      await new Promise((resolve) => setTimeout(resolve, 1));
      throw new Error("download failed");
    });

    await expect(
      importExternalImages({
        content,
        importImage,
        removeImage: vi.fn().mockRejectedValue(new Error("storage unavailable")),
      }),
    ).rejects.toMatchObject({ cleanupFailedAssetUrls: [local] });
  });
});
