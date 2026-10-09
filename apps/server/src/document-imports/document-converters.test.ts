import { describe, expect, it } from "vitest";
import JSZip from "jszip";

import { convertDocument, validateDocxArchive } from "./document-converters.ts";

describe("document import converters", () => {
  it("converts Markdown into validated BlockNote blocks", async () => {
    const progress: Array<[number, number]> = [];
    const result = await convertDocument(
      "text/markdown",
      new TextEncoder().encode("# Cálculo\n\nUma **derivada**."),
      async (current, total) => {
        progress.push([current, total]);
      },
    );

    expect(result.blocks.map((block) => block.type)).toEqual(["heading", "paragraph"]);
    expect(result.warnings).toEqual([]);
    expect(result.assets).toEqual([]);
    expect(progress).toEqual([[1, 1]]);
  });

  it("preserves paragraphs and lists from UTF-8 text imports", async () => {
    const result = await convertDocument(
      "text/plain",
      new TextEncoder().encode("Introdução\n\n- Primeiro ponto\n- Segundo ponto"),
      async () => undefined,
    );

    expect(result.blocks.map((block) => block.type)).toEqual([
      "paragraph",
      "bulletListItem",
      "bulletListItem",
    ]);
  });

  it("preserves Markdown tables as editable table blocks", async () => {
    const result = await convertDocument(
      "text/markdown",
      new TextEncoder().encode(
        "| Conceito | Definição |\n| --- | --- |\n| FSRS | Repetição espaçada |",
      ),
      async () => undefined,
    );

    const table = result.blocks.find((block) => block.type === "table");
    expect(table?.content).toMatchObject({
      rows: [
        {
          cells: [{ content: [{ text: "Conceito" }] }, { content: [{ text: "Definição" }] }],
        },
        {
          cells: [{ content: [{ text: "FSRS" }] }, { content: [{ text: "Repetição espaçada" }] }],
        },
      ],
    });
  });

  it("rejects unsupported input types", async () => {
    await expect(
      convertDocument("application/octet-stream", new Uint8Array(), async () => undefined),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FILE_TYPE" });
  });

  it("classifies malformed UTF-8 as a non-retryable input error", async () => {
    await expect(
      convertDocument("text/plain", new Uint8Array([0xc3, 0x28]), async () => undefined),
    ).rejects.toMatchObject({
      code: "INVALID_TEXT_ENCODING",
      name: "ImportConversionError",
      retryable: false,
    });
  });

  it("removes an external Markdown image without failing the complete document", async () => {
    const result = await convertDocument(
      "text/markdown",
      new TextEncoder().encode("Antes\n\n![externa](https://example.com/image.png)\n\nDepois"),
      async () => undefined,
    );

    expect(result.blocks.some((block) => block.type === "image")).toBe(false);
    expect(result.warnings).toContain("Uma imagem externa não pôde ser importada e foi removida.");
  });

  it("validates the DOCX central directory before handing data to Mammoth", async () => {
    const archive = new JSZip();
    archive.file("[Content_Types].xml", "<Types />");
    archive.file("word/document.xml", "<w:document />");
    const bytes = await archive.generateAsync({ type: "uint8array" });

    await expect(validateDocxArchive(bytes)).resolves.toBeUndefined();
    await expect(validateDocxArchive(new Uint8Array([1, 2, 3]))).rejects.toMatchObject({
      code: "INVALID_DOCX_ARCHIVE",
    });
  });

  it("preserves DOCX tables as editable table blocks", async () => {
    const archive = new JSZip();
    archive.file(
      "[Content_Types].xml",
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    );
    archive.file(
      "_rels/.rels",
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    );
    archive.file(
      "word/document.xml",
      '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Resumo</w:t></w:r></w:p><w:p><w:r><w:t>Conteúdo introdutório.</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Conceito</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Definição</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>FSRS</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Repetição espaçada</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>',
    );
    const bytes = await archive.generateAsync({ type: "uint8array" });
    const result = await convertDocument(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes,
      async () => undefined,
    );

    expect(result.blocks.map((block) => block.type)).toEqual(["heading", "paragraph", "table"]);
  });

  it("rejects a DOCX entry with an abusive compression ratio", async () => {
    const archive = new JSZip();
    archive.file("word/document.xml", "<w:document />");
    archive.file("word/media/bomb.bin", new Uint8Array(1024 * 1024));
    const bytes = await archive.generateAsync({ compression: "DEFLATE", type: "uint8array" });

    await expect(validateDocxArchive(bytes)).rejects.toMatchObject({
      code: "UNSAFE_DOCX_ARCHIVE",
    });
  });
});
