import { describe, expect, it } from "vitest";

import { formatDocumentSelectionPreview } from "./document-formatting-toolbar.tsx";

describe("document selection preview", () => {
  it("reconstructs block boundaries and list order when the browser concatenates the selection", () => {
    expect(
      formatDocumentSelectionPreview(
        "Um ciclo simplesLeia e organize a ideia principal.Feche o material e tente recuperar a informação.Revise novamente depois de algum tempo.",
        [
          {
            content: [{ styles: {}, text: "Um ciclo simples", type: "text" }],
            id: "heading",
            type: "heading",
          },
          {
            content: [{ styles: {}, text: "Leia e organize a ideia principal.", type: "text" }],
            id: "item-1",
            type: "numberedListItem",
          },
          {
            content: [
              {
                styles: {},
                text: "Feche o material e tente recuperar a informação.",
                type: "text",
              },
            ],
            id: "item-2",
            type: "numberedListItem",
          },
          {
            content: [
              {
                styles: {},
                text: "Revise novamente depois de algum tempo.",
                type: "text",
              },
            ],
            id: "item-3",
            type: "numberedListItem",
          },
        ],
        "Um ciclo simplesLeia e organize a ideia principal.Feche o material e tente recuperar a informação.Revise novamente depois de algum tempo.",
      ),
    ).toBe(
      "Um ciclo simples\n1. Leia e organize a ideia principal.\n2. Feche o material e tente recuperar a informação.\n3. Revise novamente depois de algum tempo.",
    );
  });

  it("does not trust a browser selection that differs from the editor selection", () => {
    expect(
      formatDocumentSelectionPreview(
        "Trecho correto",
        [
          {
            content: [{ styles: {}, text: "Trecho correto", type: "text" }],
            id: "paragraph",
            type: "paragraph",
          },
        ],
        "Conteúdo diferente",
      ),
    ).toBe("Trecho correto");
  });
});
