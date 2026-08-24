import { ServerBlockNoteEditor } from "@blocknote/server-util";
import {
  DOCUMENT_IMPORT_BINARY_MAX_BYTES,
  DOCUMENT_MAX_BLOCKS,
  DOCUMENT_MAX_CONTENT_BYTES,
  DOCUMENT_MAX_DEPTH,
  IMAGE_MAX_BYTES,
  documentContentSchema,
  type DocumentBlock,
} from "@lazuli/shared";
import { fileTypeFromBuffer } from "file-type";
import mammoth from "mammoth";
import sanitizeHtml from "sanitize-html";
import yauzl from "yauzl";

import { convertPdfDocument } from "./pdf-document-converter.ts";

export class ImportConversionError extends Error {
  constructor(
    readonly code: string,
    message = code,
    readonly retryable = false,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ImportConversionError";
  }
}

const editor = ServerBlockNoteEditor.create();
const DOCX_MAX_ENTRIES = 1_000;
const DOCX_MAX_ENTRY_BYTES = 25 * 1024 * 1024;
const DOCX_MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
const DOCX_MAX_COMPRESSION_RATIO = 200;

export const validateDocxArchive = (bytes: Uint8Array) =>
  new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(
      Buffer.from(bytes),
      { lazyEntries: true, validateEntrySizes: true },
      (openError, archive) => {
        if (openError || !archive) {
          reject(new ImportConversionError("INVALID_DOCX_ARCHIVE", ""));
          return;
        }
        let entries = 0;
        let uncompressedBytes = 0;
        let documentEntryFound = false;
        const fail = () => {
          archive.close();
          reject(new ImportConversionError("UNSAFE_DOCX_ARCHIVE", ""));
        };
        archive.on("entry", (entry) => {
          entries += 1;
          uncompressedBytes += entry.uncompressedSize;
          if (entry.fileName === "word/document.xml") documentEntryFound = true;
          const ratio = entry.uncompressedSize / Math.max(1, entry.compressedSize);
          if (
            entries > DOCX_MAX_ENTRIES ||
            entry.uncompressedSize > DOCX_MAX_ENTRY_BYTES ||
            uncompressedBytes > DOCX_MAX_UNCOMPRESSED_BYTES ||
            ratio > DOCX_MAX_COMPRESSION_RATIO ||
            (entry.generalPurposeBitFlag & 0x1) !== 0
          ) {
            fail();
            return;
          }
          archive.readEntry();
        });
        archive.once("end", () => {
          archive.close();
          if (!documentEntryFound) reject(new ImportConversionError("INVALID_DOCX_ARCHIVE", ""));
          else resolve();
        });
        archive.once("error", () => reject(new ImportConversionError("INVALID_DOCX_ARCHIVE", "")));
        archive.readEntry();
      },
    );
  });

const sanitizeImportedBlocks = (value: unknown, warnings: string[]): unknown => {
  if (!Array.isArray(value)) return value;
  const result: unknown[] = [];
  const pending: Array<{ source: unknown[]; target: unknown[]; depth: number }> = [
    { source: value, target: result, depth: 1 },
  ];
  let blockCount = 0;
  while (pending.length) {
    const current = pending.pop()!;
    if (current.depth > DOCUMENT_MAX_DEPTH)
      throw new ImportConversionError("UNSUPPORTED_DOCUMENT_STRUCTURE", "");
    blockCount += current.source.length;
    if (blockCount > DOCUMENT_MAX_BLOCKS)
      throw new ImportConversionError("UNSUPPORTED_DOCUMENT_STRUCTURE", "");
    for (const candidate of current.source) {
      if (!candidate || typeof candidate !== "object") {
        current.target.push(candidate);
        continue;
      }
      const block = candidate as Record<string, unknown>;
      if (block.type === "image") {
        const props = block.props;
        const url =
          props && typeof props === "object" && "url" in props
            ? (props as Record<string, unknown>).url
            : undefined;
        if (typeof url !== "string" || !/^\/api\/assets\/[0-9a-f-]{36}\/content$/i.test(url)) {
          warnings.push("Uma imagem externa não pôde ser importada e foi removida.");
          continue;
        }
      }
      if (Array.isArray(block.children)) {
        const children: unknown[] = [];
        current.target.push({ ...block, children });
        pending.push({ source: block.children, target: children, depth: current.depth + 1 });
      } else {
        current.target.push({ ...block });
      }
    }
  }
  return result;
};

const validateBlocks = (value: unknown, warnings: string[]): DocumentBlock[] => {
  const sanitizedValue = sanitizeImportedBlocks(value, warnings);
  const sanitized =
    Array.isArray(sanitizedValue) && sanitizedValue.length ? sanitizedValue : [paragraph("")];
  const json = JSON.stringify(sanitized);
  if (Buffer.byteLength(json) > DOCUMENT_MAX_CONTENT_BYTES)
    throw new ImportConversionError("CONVERTED_DOCUMENT_TOO_LARGE", "");
  const parsed = documentContentSchema.safeParse(sanitized);
  if (!parsed.success) throw new ImportConversionError("UNSUPPORTED_DOCUMENT_STRUCTURE", "");
  return parsed.data;
};

const paragraph = (text: string): DocumentBlock => ({
  id: crypto.randomUUID(),
  type: "paragraph",
  props: {},
  content: text ? [{ type: "text", text, styles: {} }] : [],
  children: [],
});

export type ConversionProgress = (current: number, total: number) => Promise<void>;

export const convertDocument = async (
  mimeType: string,
  bytes: Uint8Array,
  onProgress: ConversionProgress,
) => {
  const warnings: string[] = [];
  if (mimeType === "text/markdown" || mimeType === "text/plain") {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      throw new ImportConversionError(
        "INVALID_TEXT_ENCODING",
        "O arquivo não contém texto UTF-8 válido.",
        false,
        { cause: error },
      );
    }
    await onProgress(1, 1);
    const blocks = await editor.tryParseMarkdownToBlocks(text);
    return {
      blocks: validateBlocks(blocks, warnings),
      warnings: [...new Set(warnings)],
      assets: [],
    };
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    await onProgress(0, 1);
    await validateDocxArchive(bytes);
    const assets: Array<{ id: string; mimeType: string; bytes: Uint8Array }> = [];
    let embeddedImageBytes = 0;
    const result = await mammoth.convertToHtml(
      { buffer: Buffer.from(bytes) },
      {
        externalFileAccess: false,
        ignoreEmptyParagraphs: false,
        convertImage: mammoth.images.imgElement(async (image) => {
          const buffer = await image.read();
          const id = crypto.randomUUID();
          const detected = await fileTypeFromBuffer(buffer);
          if (
            buffer.byteLength > IMAGE_MAX_BYTES ||
            embeddedImageBytes + buffer.byteLength > DOCUMENT_IMPORT_BINARY_MAX_BYTES ||
            !detected ||
            !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(detected.mime)
          ) {
            warnings.push("Uma imagem incorporada não pôde ser importada e foi removida.");
            return { src: "" };
          }
          embeddedImageBytes += buffer.byteLength;
          assets.push({ id, mimeType: detected.mime, bytes: new Uint8Array(buffer) });
          return { src: `/api/assets/${id}/content` };
        }),
      },
    );
    if (result.messages.length)
      warnings.push("Alguns elementos do DOCX foram simplificados durante a conversão.");
    const html = sanitizeHtml(result.value, {
      allowedTags: [
        "p",
        "br",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "s",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "li",
        "blockquote",
        "pre",
        "code",
        "a",
        "img",
      ],
      allowedAttributes: { a: ["href"], img: ["src", "alt"] },
      allowedSchemes: ["http", "https", "mailto"],
      exclusiveFilter: ({ attribs, tag }) => tag === "img" && !attribs.src,
    });
    await onProgress(1, 1);
    const blocks = await editor.tryParseHTMLToBlocks(html);
    return { blocks: validateBlocks(blocks, warnings), warnings: [...new Set(warnings)], assets };
  }

  if (mimeType === "application/pdf") {
    const result = await convertPdfDocument(bytes, onProgress);
    return {
      ...result,
      blocks: validateBlocks(result.blocks, result.warnings),
      warnings: [...new Set(result.warnings)],
    };
  }

  throw new ImportConversionError("UNSUPPORTED_FILE_TYPE", "");
};

export const exportDocumentToMarkdown = (blocks: DocumentBlock[]) =>
  editor.blocksToMarkdownLossy(blocks as Parameters<typeof editor.blocksToMarkdownLossy>[0]);
