import { describe, expect, it } from "vitest";

import { summarizeFlashcardContent } from "./flashcard-queries.ts";

describe("flashcard queries", () => {
  it("derives searchable text and unique asset ids from rich content", () => {
    const assetId = "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62";
    const summary = summarizeFlashcardContent([
      {
        id: "paragraph",
        type: "paragraph",
        content: [
          { type: "text", text: "  Pergunta ", styles: {} },
          {
            type: "link",
            href: "https://example.com",
            content: [{ type: "text", text: "com link", styles: {} }],
          },
        ],
      },
      {
        id: "image",
        type: "image",
        props: { url: `/api/assets/${assetId}/content` },
      },
      {
        id: "same-image",
        type: "image",
        props: { url: `/api/assets/${assetId}/content` },
        children: [
          {
            id: "nested",
            type: "paragraph",
            content: [{ type: "text", text: "conteúdo aninhado", styles: {} }],
          },
        ],
      },
    ]);

    expect(summary).toEqual({
      assetIds: [assetId],
      hasImage: true,
      text: "Pergunta com link conteúdo aninhado",
    });
  });
});
