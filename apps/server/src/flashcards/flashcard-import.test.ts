import { FLASHCARD_IMPORT_MAX_BYTES, FLASHCARD_IMPORT_MAX_ROWS } from "@lazuli/shared";
import { describe, expect, it } from "vitest";

import { FlashcardImportError, parseFlashcardImport } from "./flashcard-import.ts";

const expectImportError = (run: () => unknown, code: FlashcardImportError["code"]) => {
  try {
    run();
    throw new Error("Expected the import to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(FlashcardImportError);
    expect((error as FlashcardImportError).code).toBe(code);
  }
};

describe("flashcard import parser", () => {
  it("reads quoted CSV with recognized headers", () => {
    const result = parseFlashcardImport(
      "cards.csv",
      Buffer.from('Pergunta,Resposta\n"O que é CSV?","Texto, separado por vírgulas"'),
    );
    expect(result.rows).toEqual([
      { question: "O que é CSV?", answer: "Texto, separado por vírgulas" },
    ]);
    expect(result.skippedRows).toBe(0);
  });

  it("reads TSV without headers and ignores incomplete rows", () => {
    const result = parseFlashcardImport(
      "cards.tsv",
      Buffer.from("Capital do Brasil?\tBrasília\nSem resposta\t"),
    );
    expect(result.rows).toEqual([{ question: "Capital do Brasil?", answer: "Brasília" }]);
    expect(result.skippedRows).toBe(1);
  });

  it("reads TXT blocks separated by blank lines", () => {
    const result = parseFlashcardImport(
      "cards.txt",
      Buffer.from("Pergunta um\nResposta um\n\nPergunta dois\nResposta dois"),
    );
    expect(result.rows).toHaveLength(2);
  });

  it("rejects unsupported files", () => {
    expectImportError(() => parseFlashcardImport("cards.pdf", Buffer.from("x")), "INVALID_FILE");
  });

  it("rejects invalid UTF-8 and imports without complete pairs", () => {
    expectImportError(
      () => parseFlashcardImport("cards.txt", Buffer.from([0xc3, 0x28])),
      "INVALID_FILE",
    );
    expectImportError(
      () => parseFlashcardImport("cards.csv", Buffer.from("Pergunta,Resposta\nIncompleta,")),
      "NO_VALID_ROWS",
    );
  });

  it("enforces file and row limits", () => {
    expectImportError(
      () => parseFlashcardImport("cards.txt", Buffer.alloc(FLASHCARD_IMPORT_MAX_BYTES + 1, "a")),
      "TOO_LARGE",
    );
    const rows = Array.from(
      { length: FLASHCARD_IMPORT_MAX_ROWS + 1 },
      (_, index) => `Pergunta ${index}\tResposta ${index}`,
    ).join("\n");
    expectImportError(() => parseFlashcardImport("cards.tsv", Buffer.from(rows)), "TOO_MANY_ROWS");
  });
});
