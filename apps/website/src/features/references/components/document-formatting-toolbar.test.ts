import { describe, expect, it } from "vitest";

import {
  formatDocumentSelectionPreview,
  getDocumentReferenceSelection,
  getDocumentSelectionPreviewParts,
  resolveDocumentSelectionText,
} from "./document-formatting-toolbar.tsx";

describe("document selection preview", () => {
  it("uses the browser text to validate a table selection when BlockNote omits its cells", () => {
    expect(
      resolveDocumentSelectionText(
        "",
        "Experimento\tConfiguração\tResultado observado\nConta bancária\tsem semáforo\t1.203.817",
        [
          {
            content: {
              columnWidths: [null, null, null],
              rows: [],
              type: "tableContent",
            },
            id: "table",
            type: "table",
          },
        ],
      ),
    ).toBe("Experimento Configuração Resultado observado Conta bancária sem semáforo 1.203.817");
  });

  it("falls back to tableContent when both selection APIs omit the cell text", () => {
    expect(
      resolveDocumentSelectionText("", "", [
        {
          content: {
            columnWidths: [null, null],
            rows: [
              {
                cells: [
                  [{ styles: {}, text: "Experimento", type: "text" }],
                  [{ styles: {}, text: "Resultado observado", type: "text" }],
                ],
              },
              {
                cells: [
                  [{ styles: {}, text: "Conta bancária", type: "text" }],
                  [{ styles: {}, text: "1.203.817", type: "text" }],
                ],
              },
            ],
            type: "tableContent",
          },
          id: "table",
          type: "table",
        },
      ]),
    ).toBe("Experimento Resultado observado Conta bancária 1.203.817");
  });

  it("keeps BlockNote text authoritative for ordinary text selections", () => {
    expect(
      resolveDocumentSelectionText("Trecho do editor", "Texto vizinho capturado", [
        {
          content: [{ styles: {}, text: "Trecho do editor", type: "text" }],
          id: "paragraph",
          type: "paragraph",
        },
      ]),
    ).toBe("Trecho do editor");
  });

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

  it("reconstructs rows and cells when a table selection is concatenated", () => {
    const blocks = [
      {
        content: [{ styles: {}, text: "Resolução da atividade prática", type: "text" as const }],
        id: "intro",
        type: "paragraph" as const,
      },
      {
        content: {
          columnWidths: [null, null],
          rows: [
            {
              cells: [
                [{ styles: { bold: true }, text: "Aluno", type: "text" as const }],
                [
                  {
                    styles: { bold: true },
                    text: "Bruno de Almeida Aseff",
                    type: "text" as const,
                  },
                ],
              ],
            },
            {
              cells: [
                [{ styles: {}, text: "Docente", type: "text" as const }],
                [{ styles: {}, text: "Thiago Felski Pereira", type: "text" as const }],
              ],
            },
            {
              cells: [
                [{ styles: {}, text: "Instituição", type: "text" as const }],
                [
                  {
                    styles: {},
                    text: "Universidade do Vale do Itajaí",
                    type: "text" as const,
                  },
                ],
              ],
            },
          ],
          type: "tableContent" as const,
        },
        id: "table",
        type: "table" as const,
      },
      {
        content: [{ styles: {}, text: "Itajaí 2026", type: "text" as const }],
        id: "footer",
        type: "paragraph" as const,
      },
    ];
    const selectedText =
      "Resolução da atividade práticaAlunoBruno de Almeida AseffDocenteThiago Felski PereiraInstituiçãoUniversidade do Vale do ItajaíItajaí 2026";
    expect(formatDocumentSelectionPreview(selectedText, blocks)).toBe(
      "Resolução da atividade prática\nAluno | Bruno de Almeida Aseff\nDocente | Thiago Felski Pereira\nInstituição | Universidade do Vale do Itajaí\nItajaí 2026",
    );
    expect(getDocumentSelectionPreviewParts(selectedText, blocks)).toEqual([
      {
        blockType: "paragraph",
        content: [{ styles: {}, text: "Resolução da atividade prática", type: "text" }],
        kind: "text",
        text: "Resolução da atividade prática",
      },
      {
        kind: "table",
        rows: [
          [
            {
              content: [{ styles: { bold: true }, text: "Aluno", type: "text" }],
              text: "Aluno",
            },
            {
              content: [{ styles: { bold: true }, text: "Bruno de Almeida Aseff", type: "text" }],
              text: "Bruno de Almeida Aseff",
            },
          ],
          [
            {
              content: [{ styles: {}, text: "Docente", type: "text" }],
              text: "Docente",
            },
            {
              content: [{ styles: {}, text: "Thiago Felski Pereira", type: "text" }],
              text: "Thiago Felski Pereira",
            },
          ],
          [
            {
              content: [{ styles: {}, text: "Instituição", type: "text" }],
              text: "Instituição",
            },
            {
              content: [{ styles: {}, text: "Universidade do Vale do Itajaí", type: "text" }],
              text: "Universidade do Vale do Itajaí",
            },
          ],
        ],
      },
      {
        blockType: "paragraph",
        content: [{ styles: {}, text: "Itajaí 2026", type: "text" }],
        kind: "text",
        text: "Itajaí 2026",
      },
    ]);
  });

  it("preserves the selected block structure when editor text cannot be matched exactly", () => {
    const blocks = [
      {
        content: [{ styles: { bold: true }, text: "Resultados principais", type: "text" as const }],
        id: "heading",
        type: "heading" as const,
      },
      {
        content: {
          columnWidths: [null, null],
          rows: [
            {
              cells: [
                [{ styles: { bold: true }, text: "Experimento", type: "text" as const }],
                [{ styles: { bold: true }, text: "Resultado", type: "text" as const }],
              ],
            },
            {
              cells: [
                [{ styles: {}, text: "Conta bancária", type: "text" as const }],
                [{ styles: {}, text: "1.203.817; 1.032.588", type: "text" as const }],
              ],
            },
          ],
          type: "tableContent" as const,
        },
        id: "table",
        type: "table" as const,
      },
      {
        content: [
          {
            styles: { italic: true },
            text: "Estação 1 Operações down e up",
            type: "text" as const,
          },
        ],
        id: "footer",
        type: "heading" as const,
      },
    ];

    const parts = getDocumentSelectionPreviewParts(
      "Resultados principais ExperimentoResultado Conta bancária1.203.817;1.032.588 Estação 1 Operações down e up",
      blocks,
    );

    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatchObject({ blockType: "heading", kind: "text" });
    expect(parts[1]).toMatchObject({
      kind: "table",
      rows: [
        [{ text: "Experimento" }, { text: "Resultado" }],
        [{ text: "Conta bancária" }, { text: "1.203.817; 1.032.588" }],
      ],
    });
    expect(parts[2]).toMatchObject({
      blockType: "heading",
      content: [{ styles: { italic: true } }],
      kind: "text",
    });
  });

  it("uses the canonical document block when the editor selection contains a shallow table", () => {
    const table = {
      content: {
        columnWidths: [null, null],
        rows: [
          {
            cells: [
              [{ styles: { bold: true }, text: "Experimento", type: "text" as const }],
              [{ styles: { italic: true }, text: "Resultado", type: "text" as const }],
            ],
          },
        ],
        type: "tableContent" as const,
      },
      id: "table",
      type: "table" as const,
    };
    const result = getDocumentReferenceSelection({
      addStyles: () => undefined,
      document: [table],
      getActiveStyles: () => ({}),
      getSelectedText: () => "ExperimentoResultado",
      getSelection: () => ({ blocks: [{ id: "table", type: "table" }] }),
    });

    expect(result?.selectedPreviewParts).toEqual([
      {
        kind: "table",
        rows: [
          [
            {
              content: [{ styles: { bold: true }, text: "Experimento", type: "text" }],
              text: "Experimento",
            },
            {
              content: [{ styles: { italic: true }, text: "Resultado", type: "text" }],
              text: "Resultado",
            },
          ],
        ],
      },
    ]);
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

  it("formats bullet, checklist, and quote blocks", () => {
    expect(
      formatDocumentSelectionPreview("PrimeiroSegundoTerceiro", [
        {
          content: [{ styles: {}, text: "Primeiro", type: "text" }],
          id: "1",
          type: "bulletListItem",
        },
        {
          content: [{ styles: {}, text: "Segundo", type: "text" }],
          id: "2",
          type: "checkListItem",
        },
        { content: [{ styles: {}, text: "Terceiro", type: "text" }], id: "3", type: "quote" },
      ]),
    ).toBe("• Primeiro\n☐ Segundo\n> Terceiro");
  });

  it("uses paragraph formatting when fallback lines and blocks do not correspond", () => {
    expect(
      formatDocumentSelectionPreview("Primeiro\nSegundo", [
        { content: [{ styles: {}, text: "Outro", type: "text" }], id: "1", type: "bulletListItem" },
      ]),
    ).toBe("Primeiro\nSegundo");
  });

  it("restarts numbering after a non-list block", () => {
    expect(
      formatDocumentSelectionPreview("UmTextoDois", [
        { content: [{ styles: {}, text: "Um", type: "text" }], id: "1", type: "numberedListItem" },
        { content: [{ styles: {}, text: "Texto", type: "text" }], id: "2", type: "paragraph" },
        {
          content: [{ styles: {}, text: "Dois", type: "text" }],
          id: "3",
          type: "numberedListItem",
        },
      ]),
    ).toBe("1. Um\nTexto\n1. Dois");
  });
});
