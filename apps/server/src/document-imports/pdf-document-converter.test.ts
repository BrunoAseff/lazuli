import { describe, expect, it, vi } from "vitest";

import {
  convertPdfTextLines,
  extractStructuredPdfTables,
  isSoftMaskLayer,
  normalizePdfText,
  resolvePdfImageObject,
} from "./pdf-document-converter.ts";

const textItem = (str: string, x: number, y: number, height = 11, fontName = "regular") => ({
  str,
  width: Math.max(str.length * 6, 2),
  height,
  fontName,
  transform: [height, 0, 0, height, x, y],
});

describe("PDF document converter", () => {
  it("keeps bold sentences and bold list entries out of headings", () => {
    const elements = convertPdfTextLines([
      textItem(
        "Corpo do texto para definir a fonte normal do documento, que é a mais usada.",
        72,
        790,
      ),
      textItem(
        "Mais uma linha de corpo para que o texto regular predomine sobre o negrito.",
        72,
        776,
      ),
      textItem(
        "Terceira linha de corpo, como num documento de verdade com parágrafos longos.",
        72,
        762,
      ),
      textItem("Despesas com aquisição", 72, 720, 11, "bold"),
      textItem("• Existem dois tipos de despesas;", 72, 690, 11, "bold"),
      textItem("Uma frase inteira em negrito que termina com ponto.", 72, 660, 11, "bold"),
    ]);
    expect(elements.map(({ block }) => block.type)).toEqual([
      "paragraph",
      "heading",
      "bulletListItem",
      "paragraph",
    ]);
  });

  it("reads two side-by-side columns one after the other", () => {
    const elements = convertPdfTextLines([
      textItem("Cenário 1", 54, 320, 11, "bold"),
      textItem("Esquerda primeira", 54, 300),
      textItem("Esquerda segunda", 54, 286),
      textItem("Cenário 2", 315, 320, 11, "bold"),
      textItem("Direita primeira", 315, 300),
      textItem("Direita segunda", 315, 286),
      textItem("Texto em largura total depois das colunas, atravessando a página.", 54, 240),
    ]);
    const texts = elements.map(({ block }) =>
      (block.content as Array<{ text: string }>).map(({ text }) => text).join(""),
    );
    expect(texts).toEqual([
      "Cenário 1",
      "Esquerda primeira Esquerda segunda",
      "Cenário 2",
      "Direita primeira Direita segunda",
      "Texto em largura total depois das colunas, atravessando a página.",
    ]);
  });

  it("recognizes grayscale shadow masks and keeps real images", () => {
    const image = (paint: (x: number, y: number) => [number, number, number]) => {
      const width = 20,
        height = 12,
        data = new Uint8Array(width * height * 3);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) data.set(paint(x, y), (y * width + x) * 3);
      return { data, height, kind: 2, width };
    };
    const inside = (x: number, y: number) => x > 2 && x < 17 && y > 2 && y < 9;
    expect(isSoftMaskLayer(image((x, y) => (inside(x, y) ? [255, 255, 255] : [0, 0, 0])))).toBe(
      true,
    );
    // A photo-like image with color is content.
    expect(isSoftMaskLayer(image((x, y) => (inside(x, y) ? [250, 240, 200] : [0, 0, 0])))).toBe(
      false,
    );
    // A white-background diagram is content too.
    expect(isSoftMaskLayer(image(() => [255, 255, 255]))).toBe(false);
  });

  it("restores tracked titles and drops unmapped symbol glyphs", () => {
    expect(normalizePdfText("U N I V E R S I D A D E")).toBe("UNIVERSIDADE");
    expect(normalizePdfText("\uE08B")).toBe("");
    // Ordinary prose with short words keeps its spaces.
    expect(normalizePdfText("a e o")).toBe("a e o");
    expect(normalizePdfText("Avaliação Prática M2")).toBe("Avaliação Prática M2");

    const elements = convertPdfTextLines([
      textItem("U N I V E R S I D A D E", 72, 760),
      textItem(" ", 160, 760),
      textItem("D O", 168, 760),
      textItem("SisCOAP ", 72, 720),
      textItem("\uE08B", 125, 720),
      textItem(" Sistema", 135, 720),
    ]);
    const texts = elements.map(({ block }) =>
      (block.content as Array<{ text: string }>).map(({ text }) => text).join(""),
    );
    expect(texts[0]).toBe("UNIVERSIDADE DO");
    expect(texts[1]).toBe("SisCOAP Sistema");
  });

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
    const content = elements[1]?.block.content;
    expect(
      Array.isArray(content)
        ? content.map((item) => (item.type === "text" ? item.text : "")).join("")
        : "",
    ).toContain("continuação do parágrafo.");
  });

  it("preserves tagged PDF tables without duplicating their text in paragraphs", () => {
    const marked = (id: string, text: string, x: number, y: number) => [
      { type: "beginMarkedContentProps", id, tag: "P" },
      textItem(text, x, y),
      { type: "endMarkedContent" },
    ];
    const items = [
      ...marked("intro", "Resultados", 72, 760),
      ...marked("head-a", "Experimento", 72, 720),
      ...marked("head-b", "Resultado", 240, 720),
      ...marked("cell-a", "Conta bancária", 72, 690),
      ...marked("cell-b", "Nenhuma perda", 240, 690),
    ];
    const content = (id: string) => ({ type: "content", id });
    const cell = (role: "TH" | "TD", id: string) => ({
      role,
      children: [{ role: "P", children: [content(id)] }],
    });
    const structure = {
      role: "Root",
      children: [
        {
          role: "Document",
          children: [
            { role: "P", children: [content("intro")] },
            {
              role: "Table",
              children: [
                { role: "TR", children: [cell("TH", "head-a"), cell("TH", "head-b")] },
                { role: "TR", children: [cell("TD", "cell-a"), cell("TD", "cell-b")] },
              ],
            },
          ],
        },
      ],
    };

    const result = extractStructuredPdfTables(items, structure);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]?.block).toMatchObject({
      type: "table",
      content: {
        headerRows: 1,
        rows: [
          {
            cells: [
              { content: [{ text: "Experimento", styles: { bold: true } }] },
              { content: [{ text: "Resultado", styles: { bold: true } }] },
            ],
          },
          {
            cells: [
              { content: [{ text: "Conta bancária" }] },
              { content: [{ text: "Nenhuma perda" }] },
            ],
          },
        ],
      },
    });
    expect(convertPdfTextLines(result.remainingItems)).toHaveLength(1);
  });
});
