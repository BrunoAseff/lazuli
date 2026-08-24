import { describe, expect, it, vi } from "vitest";

import { convertPdfTextLines, resolvePdfImageObject } from "./pdf-document-converter.ts";

const textItem = (str: string, x: number, y: number, height = 11, fontName = "regular") => ({
  str,
  width: Math.max(str.length * 6, 2),
  height,
  fontName,
  transform: [height, 0, 0, height, x, y],
});

describe("PDF document converter", () => {
  it("resolves shared PDF images from the global object pool", async () => {
    const image = { width: 10, height: 10, data: new Uint8Array(300) };
    const localGet = vi.fn();
    const globalGet = vi.fn((_name: string, callback: (value: typeof image) => void) =>
      callback(image),
    );

    await expect(
      resolvePdfImageObject(
        { commonObjs: { get: globalGet }, objs: { get: localGet } },
        "g_d0_img_p1_1",
      ),
    ).resolves.toBe(image);
    expect(globalGet).toHaveBeenCalledOnce();
    expect(localGet).not.toHaveBeenCalled();
  });

  it("recovers headings, paragraphs, line wrapping, bold text and lists", () => {
    const elements = convertPdfTextLines([
      textItem("1. Título", 72, 760, 18),
      textItem("Primeira linha ", 72, 720),
      textItem("em negrito", 150, 720, 11, "bold"),
      textItem("continuação do parágrafo.", 72, 706),
      textItem("● ", 90, 670),
      textItem("Primeiro item", 108, 670),
      textItem("● ", 90, 656),
      textItem("Segundo item", 108, 656),
    ]);

    expect(elements.map(({ block }) => block.type)).toEqual([
      "heading",
      "paragraph",
      "bulletListItem",
      "bulletListItem",
    ]);
    expect(elements[1]?.block.content).toContainEqual({
      type: "text",
      text: "em negrito",
      styles: { bold: true },
    });
    expect(
      elements[1]?.block.content?.map((item) => (item.type === "text" ? item.text : "")).join(""),
    ).toContain("continuação do parágrafo.");
  });
});
