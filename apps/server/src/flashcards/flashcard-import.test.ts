import { describe, expect, it } from "vitest";

import { FlashcardImportError, parseFlashcardImport } from "./flashcard-import.ts";

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
    expect(() => parseFlashcardImport("cards.pdf", Buffer.from("x"))).toThrowError(
      FlashcardImportError,
    );
  });
});
