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
