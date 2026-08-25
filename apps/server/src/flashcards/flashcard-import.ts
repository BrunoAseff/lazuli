import {
  FLASHCARD_IMPORT_MAX_BYTES,
  FLASHCARD_IMPORT_MAX_ROWS,
  FLASHCARD_IMPORT_TEXT_MAX_LENGTH,
  flashcardImportPreviewSchema,
  type FlashcardImportPreview,
} from "@lazuli/shared";

export class FlashcardImportError extends Error {
  constructor(
    public readonly code: "INVALID_FILE" | "TOO_LARGE" | "TOO_MANY_ROWS" | "NO_VALID_ROWS",
  ) {
    super(code);
  }
}

const normalizeHeader = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const questionHeaders = new Set(["pergunta", "question", "front", "frente"]);
const answerHeaders = new Set(["resposta", "answer", "back", "verso"]);

const parseDelimited = (text: string, delimiter: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted) throw new FlashcardImportError("INVALID_FILE");
  if (field || row.length) rows.push([...row, field]);
  return rows;
};

const delimiterScore = (text: string, delimiter: string) => {
  const sample = text.split(/\r?\n/).slice(0, 10).join("\n");
  try {
    const rows = parseDelimited(sample, delimiter).filter((row) => row.some(Boolean));
    return rows.filter((row) => row.length >= 2).length;
  } catch {
    return 0;
  }
};

const inferDelimiter = (text: string, preferred?: string) => {
  if (preferred && delimiterScore(text, preferred)) return preferred;
  const delimiter = ["\t", ",", ";"].sort(
    (left, right) => delimiterScore(text, right) - delimiterScore(text, left),
  )[0]!;
  return delimiterScore(text, delimiter) ? delimiter : null;
};

const extractRows = (raw: string[][]) => {
  const rows = raw.filter((row) => row.some((value) => value.trim()));
  if (!rows.length) return [];
  const header = rows[0]!.map(normalizeHeader);
  const questionIndex = header.findIndex((value) => questionHeaders.has(value));
  const answerIndex = header.findIndex((value) => answerHeaders.has(value));
  const hasHeader = questionIndex >= 0 && answerIndex >= 0;
  return (hasHeader ? rows.slice(1) : rows).map((row) => ({
    question: (row[hasHeader ? questionIndex : 0] ?? "").trim(),
    answer: (row[hasHeader ? answerIndex : 1] ?? "").trim(),
  }));
};

const parseTextBlocks = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((block) => block.split(/\r?\n/).map((line) => line.trim()))
    .map(([question = "", ...answer]) => ({ question, answer: answer.join("\n").trim() }));

export const parseFlashcardImport = (filename: string, buffer: Buffer): FlashcardImportPreview => {
  if (buffer.byteLength > FLASHCARD_IMPORT_MAX_BYTES) throw new FlashcardImportError("TOO_LARGE");
  const extension = filename.toLowerCase().split(".").pop();
  if (!extension || !["csv", "tsv", "txt"].includes(extension))
    throw new FlashcardImportError("INVALID_FILE");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    throw new FlashcardImportError("INVALID_FILE");
  }
  const format = extension as "csv" | "tsv" | "txt";
  const delimiter = inferDelimiter(text, format === "tsv" ? "\t" : undefined);
  if (format !== "txt" && !delimiter) throw new FlashcardImportError("INVALID_FILE");
  const parsed = delimiter ? extractRows(parseDelimited(text, delimiter)) : parseTextBlocks(text);
  if (parsed.length > FLASHCARD_IMPORT_MAX_ROWS) throw new FlashcardImportError("TOO_MANY_ROWS");
  const valid = parsed.filter(
    ({ answer, question }) =>
      question.length > 0 &&
      answer.length > 0 &&
      question.length <= FLASHCARD_IMPORT_TEXT_MAX_LENGTH &&
      answer.length <= FLASHCARD_IMPORT_TEXT_MAX_LENGTH,
  );
  if (!valid.length) throw new FlashcardImportError("NO_VALID_ROWS");
  return flashcardImportPreviewSchema.parse({
    format,
    rows: valid,
    skippedRows: parsed.length - valid.length,
  });
};

export const plainTextFlashcardContent = (text: string) =>
  text.split(/\r?\n/).map((line) => ({
    id: crypto.randomUUID(),
    type: "paragraph" as const,
    content: line ? [{ type: "text" as const, text: line, styles: {} }] : [],
  }));
