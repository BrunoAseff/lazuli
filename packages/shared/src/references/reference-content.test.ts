import { describe, expect, it } from "vitest";

import type { DocumentBlock } from "../documents/document-contracts.ts";
import {
  addSourceAnchorToQuote,
  collectReferenceSourceIds,
  collectSourceAnchorIds,
  getDocumentBlockText,
  getReferenceSourcePreview,
  removeSourceAnchors,
} from "./reference-content.ts";

const content: DocumentBlock[] = [
  {
    id: "one",
    type: "paragraph",
    content: [
      { type: "text", text: "Um", styles: { sourceAnchor: "anchor-one", bold: true } },
      {
        type: "link",
        href: "https://example.com",
        content: [{ type: "text", text: "Dois", styles: { sourceAnchor: "anchor-two" } }],
      },
    ],
  },
];

describe("reference content helpers", () => {
  it("anchors an exact quote split across styled text", () => {
    const source: DocumentBlock[] = [
      {
        id: "paragraph",
        type: "paragraph",
        content: [
          { type: "text", text: "Recuperação ", styles: { bold: true } },
          { type: "text", text: "ativa melhora a memória.", styles: {} },
        ],
      },
    ];
    const result = addSourceAnchorToQuote(source, {
      anchorId: "generated-anchor",
      blockId: "paragraph",
      quote: "Recuperação ativa melhora",
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(getReferenceSourcePreview(result.content, "generated-anchor")).toBe(
      "Recuperação ativa melhora",
    );
    expect(source[0]?.content).toHaveLength(2);
  });

  it("reuses an existing anchor for the same passage", () => {
    const result = addSourceAnchorToQuote(content, {
      anchorId: "ignored-anchor",
      blockId: "one",
      quote: "Um",
    });
    expect(result).toMatchObject({ anchorId: "anchor-one", changed: false, kind: "ok" });
  });

  it("rejects an ambiguous quote instead of linking the wrong passage", () => {
    const repeated: DocumentBlock[] = [
      {
        id: "repeated",
        type: "paragraph",
        content: [{ type: "text", text: "conceito e conceito", styles: {} }],
      },
    ];
    expect(
      addSourceAnchorToQuote(repeated, {
        anchorId: "anchor",
        blockId: "repeated",
        quote: "conceito",
      }),
    ).toEqual({ kind: "ambiguous" });
  });

  it("normalizes whitespace while preserving the exact styled passage", () => {
    const source: DocumentBlock[] = [
      {
        id: "whitespace",
        type: "paragraph",
        content: [
          { type: "text", text: "Uma ideia\n\t", styles: {} },
          { type: "text", text: "importante permanece.", styles: { italic: true } },
        ],
      },
    ];
    const result = addSourceAnchorToQuote(source, {
      anchorId: "normalized-anchor",
      blockId: "whitespace",
      quote: "Uma ideia importante",
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(getReferenceSourcePreview(result.content, "normalized-anchor")).toBe(
      "Uma ideia importante",
    );
  });

  it("anchors a quote inside a table cell while preserving the table", () => {
    const source: DocumentBlock[] = [
      {
        id: "table",
        type: "table",
        content: {
          type: "tableContent",
          columnWidths: [null, null],
          rows: [
            {
              cells: [
                [{ type: "text", text: "Conceito", styles: { bold: true } }],
                {
                  type: "tableCell",
                  props: {},
                  content: [{ type: "text", text: "Recuperação ativa", styles: {} }],
                },
              ],
            },
          ],
        },
      },
    ];
    const result = addSourceAnchorToQuote(source, {
      anchorId: "table-anchor",
      blockId: "table",
      quote: "Recuperação",
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(getReferenceSourcePreview(result.content, "table-anchor")).toBe("Recuperação");
    expect(result.content[0]?.type).toBe("table");
  });

  it("rejects an empty normalized quote inside a table", () => {
    const source: DocumentBlock[] = [
      {
        id: "table",
        type: "table",
        content: {
          type: "tableContent",
          columnWidths: [null],
          rows: [{ cells: [[{ type: "text", text: "Conteúdo", styles: {} }]] }],
        },
      },
    ];

    expect(
      addSourceAnchorToQuote(source, {
        anchorId: "table-anchor",
        blockId: "table",
        quote: " \n\t ",
      }),
    ).toEqual({ kind: "quote-not-found" });
  });

  it("collects anchors from plain and linked text", () => {
    expect(collectSourceAnchorIds(content)).toEqual(new Set(["anchor-one", "anchor-two"]));
  });

  it("removes only requested anchors while preserving other styles", () => {
    const result = removeSourceAnchors(content, new Set(["anchor-one"]));
    expect(result.changed).toBe(true);
    const updatedInline = result.content[0]?.content;
    expect(Array.isArray(updatedInline) ? updatedInline[0] : undefined).toMatchObject({
      styles: { bold: true },
    });
    expect(collectSourceAnchorIds(result.content)).toEqual(new Set(["anchor-two"]));
    const originalInline = content[0]?.content;
    expect(Array.isArray(originalInline) ? originalInline[0] : undefined).toMatchObject({
      styles: { bold: true, sourceAnchor: "anchor-one" },
    });
  });

  it("keeps the original array when no anchor changes", () => {
    const result = removeSourceAnchors(content, new Set(["missing"]));
    expect(result.changed).toBe(false);
    expect(result.content).toBe(content);
  });

  it("uses stable image block ids as reference sources", () => {
    expect(collectReferenceSourceIds([...content, { id: "image-one", type: "image" }])).toEqual(
      new Set(["anchor-one", "anchor-two", "image-one"]),
    );
  });

  it("builds a preview only from the selected textual reference", () => {
    expect(getReferenceSourcePreview(content, "anchor-two")).toBe("Dois");
  });

  it("does not insert spaces where styles split a word", () => {
    const splitWord: DocumentBlock = {
      id: "split-word",
      type: "paragraph",
      content: [
        { type: "text", text: "exem", styles: { sourceAnchor: "anchor-split" } },
        { type: "text", text: "plo", styles: { bold: true, sourceAnchor: "anchor-split" } },
      ],
    };

    expect(getDocumentBlockText(splitWord)).toBe("exemplo");
    expect(getReferenceSourcePreview([splitWord], "anchor-split")).toBe("exemplo");
  });

  it("identifies an image reference without requiring document navigation", () => {
    expect(
      getReferenceSourcePreview([...content, { id: "image-one", type: "image" }], "image-one"),
    ).toBe("Imagem vinculada");
  });

  it("keeps nested document content in depth-first reading order", () => {
    const nested: DocumentBlock[] = [
      {
        id: "parent",
        type: "paragraph",
        content: [{ type: "text", text: "Pai", styles: {} }],
        children: [
          {
            id: "child",
            type: "paragraph",
            content: [{ type: "text", text: "Filho", styles: {} }],
          },
        ],
      },
      {
        id: "sibling",
        type: "paragraph",
        content: [{ type: "text", text: "Irmão", styles: {} }],
      },
    ];
    expect(getReferenceSourcePreview(nested, null)).toBe("Pai Filho Irmão");
  });
});
