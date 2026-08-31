import { describe, expect, it } from "vitest";

import type { DocumentBlock } from "../documents/document-contracts.ts";
import {
  collectReferenceSourceIds,
  collectSourceAnchorIds,
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
  it("collects anchors from plain and linked text", () => {
    expect(collectSourceAnchorIds(content)).toEqual(new Set(["anchor-one", "anchor-two"]));
  });

  it("removes only requested anchors while preserving other styles", () => {
    const result = removeSourceAnchors(content, new Set(["anchor-one"]));
    expect(result.changed).toBe(true);
    expect(result.content[0]?.content?.[0]).toMatchObject({ styles: { bold: true } });
    expect(collectSourceAnchorIds(result.content)).toEqual(new Set(["anchor-two"]));
    expect(content[0]?.content?.[0]).toMatchObject({
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
