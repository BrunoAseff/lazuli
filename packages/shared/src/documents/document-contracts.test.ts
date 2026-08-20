import { describe, expect, it } from "vitest";

import {
  DOCUMENT_IMPORT_MARKDOWN_MAX_BYTES,
  DOCUMENT_MAX_DEPTH,
  createDocumentImportSchema,
  documentContentSchema,
  projectItemTitleSchema,
  updateProjectItemSchema,
} from "./document-contracts.ts";

const paragraph = (id = "block-1", content: unknown[] = []) => ({
  id,
  type: "paragraph",
  props: {},
  content,
  children: [],
});

describe("document contracts", () => {
  it("normalizes item titles", () => {
    expect(projectItemTitleSchema.parse("  Cálculo   I ")).toBe("Cálculo I");
  });

  it("accepts rename or move operations and rejects an empty update", () => {
    expect(updateProjectItemSchema.parse({ parentId: null })).toEqual({ parentId: null });
    expect(updateProjectItemSchema.parse({ title: "  Física  II " })).toEqual({
      title: "Física II",
    });
    expect(updateProjectItemSchema.safeParse({}).success).toBe(false);
  });

  it("preserves block and source anchor identifiers", () => {
    const content = [
      paragraph("block-stable", [
        { type: "text", text: "Derivadas", styles: { sourceAnchor: "anchor-stable" } },
      ]),
    ];
    expect(documentContentSchema.parse(content)).toEqual(content);
  });

  it("rejects duplicate block IDs and unsupported blocks", () => {
    expect(documentContentSchema.safeParse([paragraph(), paragraph()]).success).toBe(false);
    expect(documentContentSchema.safeParse([{ ...paragraph(), type: "video" }]).success).toBe(
      false,
    );
  });

  it("rejects unsafe links and arbitrary image URLs", () => {
    const unsafeLink = paragraph("link", [
      {
        type: "link",
        href: "javascript:alert(1)",
        content: [{ type: "text", text: "x", styles: {} }],
      },
    ]);
    const externalImage = {
      id: "image",
      type: "image",
      props: { url: "https://example.com/a.png" },
      children: [],
    };
    expect(documentContentSchema.safeParse([unsafeLink]).success).toBe(false);
    expect(documentContentSchema.safeParse([externalImage]).success).toBe(false);
  });

  it("rejects excessive nesting before the recursive block parser runs", () => {
    const root: Record<string, unknown> = {
      id: "root",
      type: "paragraph",
      props: {},
      content: [],
      children: [],
    };
    let current = root;
    for (let depth = 0; depth <= DOCUMENT_MAX_DEPTH; depth += 1) {
      const child: Record<string, unknown> = {
        id: `child-${depth}`,
        type: "paragraph",
        props: {},
        content: [],
        children: [],
      };
      current.children = [child];
      current = child;
    }
    expect(documentContentSchema.safeParse([root]).success).toBe(false);
  });

  it("accepts only supported document import metadata", () => {
    const valid = {
      id: "00000000-0000-4000-8000-000000000001",
      documentId: "00000000-0000-4000-8000-000000000002",
      parentId: null,
      originalName: "anotações.md",
      mimeType: "text/markdown",
      byteSize: 128,
    };
    expect(createDocumentImportSchema.safeParse(valid).success).toBe(true);
    expect(
      createDocumentImportSchema.safeParse({ ...valid, mimeType: "application/x-msdownload" })
        .success,
    ).toBe(false);
    expect(
      createDocumentImportSchema.safeParse({
        ...valid,
        byteSize: DOCUMENT_IMPORT_MARKDOWN_MAX_BYTES + 1,
      }).success,
    ).toBe(false);
  });
});
