import {
  DOCUMENT_IMPORT_BINARY_MAX_BYTES,
  DOCUMENT_IMPORT_MAX_PDF_PAGES,
  IMAGE_MAX_BYTES,
  getDocumentBlockText,
  type DocumentBlock,
  type DocumentInlineContent,
} from "@lazuli/shared";
import { getDocument, ImageKind, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";

type PdfRun = {
  color?: string;
  fontName: string;
  height: number;
  text: string;
  tracked?: boolean;
  width: number;
  x: number;
  y: number;
};

type PdfLine = {
  height: number;
  runs: PdfRun[];
  x: number;
  y: number;
};

type PdfImage = {
  data?: Uint8Array | Uint8ClampedArray;
  height: number;
  kind?: number;
  width: number;
};

type PdfAsset = { id: string; mimeType: string; bytes: Uint8Array };
type PdfElement = { block: DocumentBlock; y: number };
type PdfStructureNode = {
  children?: PdfStructureNode[];
  id?: string;
  role?: string;
  type?: string;
};
type Matrix = [number, number, number, number, number, number];
type PdfObjectPool = { get: (name: string, callback: (image: PdfImage) => void) => void };
type TextContent = Extract<DocumentInlineContent, { type: "text" }>;

const PDF_IMAGE_RESOLUTION_TIMEOUT_MS = 3_000;
const PDF_MAX_EXTRACTED_IMAGES = 50;

class PdfImportError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const multiplyMatrices = (left: Matrix, right: Matrix): Matrix => [
  left[0] * right[0] + left[2] * right[1],
  left[1] * right[0] + left[3] * right[1],
  left[0] * right[2] + left[2] * right[3],
  left[1] * right[2] + left[3] * right[3],
  left[0] * right[4] + left[2] * right[5] + left[4],
  left[1] * right[4] + left[3] * right[5] + left[5],
];

const median = (values: number[]) => {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)] ?? 12;
};

/**
 * Text as the PDF stores it is not always text as it reads:
 * - tracked (letter-spaced) titles arrive as "U N I V E R S I D A D E", word breaks in separate items;
 * - symbol fonts without a Unicode map arrive as private-use code points, which render as empty boxes.
 */
const TRACKED_WORD = /^(?:\S ){3,}\S$/u;
const SPACED_LETTERS = /^(?:\S )+\S$/u;
const PRIVATE_USE = /[\uE000-\uF8FF]/gu;
export const normalizePdfText = (text: string) => {
  const visible = text.replace(PRIVATE_USE, "");
  return TRACKED_WORD.test(visible) ? visible.replaceAll(" ", "") : visible;
};
/** On a tracked line, short words ("D O") are tracked too, even below the single-item threshold. */
const untrackLine = (line: PdfLine) => {
  if (!line.runs.some((run) => run.tracked)) return;
  for (const run of line.runs)
    if (SPACED_LETTERS.test(run.text)) run.text = run.text.replaceAll(" ", "");
};

const lineEnd = (line: PdfLine) => Math.max(...line.runs.map((run) => run.x + run.width), line.x);

/** Inserts positioned elements (tables, images) into text that is already in reading order. */
export const placeByPosition = (text: PdfElement[], placed: PdfElement[]) => {
  const result = [...text];
  for (const element of [...placed].sort((left, right) => right.y - left.y)) {
    const index = result.findIndex((candidate) => candidate.y < element.y);
    result.splice(index < 0 ? result.length : index, 0, element);
  }
  return result;
};

/**
 * Two-column bands read column by column: from the first row where two lines share a baseline
 * with a gutter between them, every line that sits entirely on one side of the gutter belongs to
 * the band; the left column is emitted first, then the right. A full-width line ends the band.
 */
export const orderColumns = (lines: PdfLine[]) => {
  const sameRow = (left: PdfLine, right: PdfLine) =>
    Math.abs(left.y - right.y) <= Math.max(1.5, Math.max(left.height, right.height) * 0.12);
  const ordered: PdfLine[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]!;
    const partner = lines.find(
      (other) => other !== line && sameRow(line, other) && other.x > lineEnd(line),
    );
    if (!partner) {
      ordered.push(line);
      index += 1;
      continue;
    }
    const gutter = partner.x;
    const band: PdfLine[] = [];
    while (index < lines.length) {
      const candidate = lines[index]!;
      const left = lineEnd(candidate) <= gutter + 1;
      const right = candidate.x >= gutter - 1;
      if (!left && !right) break;
      band.push(candidate);
      index += 1;
    }
    ordered.push(
      ...band.filter((candidate) => candidate.x < gutter - 1),
      ...band.filter((candidate) => candidate.x >= gutter - 1),
    );
  }
  return ordered;
};

const groupTextLines = (items: unknown[]): PdfLine[] => {
  const lines: PdfLine[] = [];
  for (const candidate of items) {
    if (!candidate || typeof candidate !== "object" || !("str" in candidate)) continue;
    const item = candidate as {
      fontName: string;
      height: number;
      str: string;
      textColor?: string;
      transform: number[];
      width: number;
    };
    const text = normalizePdfText(item.str);
    if (!text) continue;
    const run: PdfRun = {
      tracked: text !== item.str.replace(PRIVATE_USE, ""),
      color: item.textColor,
      fontName: item.fontName,
      height: Math.abs(item.height || item.transform[3] || 0),
      text,
      width: item.width,
      x: item.transform[4] ?? 0,
      y: item.transform[5] ?? 0,
    };
    // Same baseline is not enough: a run far to the right of the line's end belongs to another
    // column (two-column layouts would otherwise read across both columns at once).
    let line = lines.find(
      (current) =>
        Math.abs(current.y - run.y) <= Math.max(1.5, run.height * 0.12) &&
        run.x - lineEnd(current) <= Math.max(24, run.height * 4),
    );
    if (!line) {
      line = { height: run.height, runs: [], x: run.x, y: run.y };
      lines.push(line);
    }
    line.runs.push(run);
    line.height = Math.max(line.height, run.height);
    line.x = Math.min(line.x, run.x);
  }
  for (const line of lines) {
    line.runs.sort((left, right) => left.x - right.x);
    untrackLine(line);
  }
  return orderColumns(lines.sort((left, right) => right.y - left.y || left.x - right.x));
};

const lineText = (line: PdfLine) =>
  line.runs
    .map((run) => run.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();

const lineContent = (line: PdfLine, normalFont: string) => {
  const content: TextContent[] = [];
  let previousEnd: number | null = null;
  for (const run of line.runs) {
    let text = run.text.replace(/\s+/g, " ");
    if (content.at(-1)?.text.endsWith(" ")) text = text.trimStart();
    if (!text) continue;
    if (
      previousEnd !== null &&
      run.x - previousEnd > Math.max(1.5, line.height * 0.15) &&
      !text.startsWith(" ") &&
      !content.at(-1)?.text.endsWith(" ")
    )
      text = ` ${text}`;
    const styles: TextContent["styles"] = {};
    if (run.fontName !== normalFont) styles.bold = true;
    if (run.color && !["#000000", "#000", "black"].includes(run.color.toLowerCase()))
      styles.textColor = run.color;
    const previous = content.at(-1);
    if (previous?.type === "text" && JSON.stringify(previous.styles) === JSON.stringify(styles))
      previous.text += text;
    else content.push({ type: "text", text, styles });
    previousEnd = run.x + run.width;
  }
  if (content[0]?.type === "text") content[0].text = content[0].text.trimStart();
  if (content.at(-1)?.type === "text") content.at(-1)!.text = content.at(-1)!.text.trimEnd();
  return content.filter((item) => item.type !== "text" || item.text.length > 0);
};

const contentIds = (node: PdfStructureNode): string[] => [
  ...(node.type === "content" && node.id ? [node.id] : []),
  ...(node.children?.flatMap(contentIds) ?? []),
];

const nodesWithRole = (node: PdfStructureNode, role: string): PdfStructureNode[] => [
  ...(node.role === role ? [node] : []),
  ...(node.children?.flatMap((child) => nodesWithRole(child, role)) ?? []),
];

const markedTextItems = (items: unknown[]) => {
  const byId = new Map<string, unknown[]>();
  const stack: string[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    if ("type" in item && item.type === "beginMarkedContentProps") {
      const id = "id" in item && typeof item.id === "string" ? item.id : "";
      stack.push(id);
      continue;
    }
    if ("type" in item && item.type === "endMarkedContent") {
      stack.pop();
      continue;
    }
    if (!("str" in item)) continue;
    for (const id of stack) {
      if (!id) continue;
      const grouped = byId.get(id) ?? [];
      grouped.push(item);
      byId.set(id, grouped);
    }
  }
  return byId;
};

const inlineContentForItems = (items: unknown[], forceBold = false) => {
  const lines = groupTextLines(items).filter((line) => lineText(line));
  if (!lines.length) return [];
  const fontUsage = new Map<string, number>();
  for (const line of lines)
    for (const run of line.runs)
      fontUsage.set(run.fontName, (fontUsage.get(run.fontName) ?? 0) + run.text.length);
  const normalFont =
    [...fontUsage].sort((left, right) => right[1] - left[1])[0]?.[0] ?? lines[0]!.runs[0]!.fontName;
  const content: TextContent[] = [];
  for (const line of lines) {
    if (content.length) content.push({ type: "text", text: "\n", styles: {} });
    for (const item of lineContent(line, normalFont)) {
      content.push(forceBold ? { ...item, styles: { ...item.styles, bold: true } } : item);
    }
  }
  return content;
};

export const extractStructuredPdfTables = (
  items: unknown[],
  structure: PdfStructureNode | null,
): { elements: PdfElement[]; remainingItems: unknown[] } => {
  if (!structure) return { elements: [], remainingItems: items };
  const groupedItems = markedTextItems(items);
  const usedIds = new Set<string>();
  const elements: PdfElement[] = [];

  for (const table of nodesWithRole(structure, "Table")) {
    const tableIds = new Set<string>();
    const rows = nodesWithRole(table, "TR").map((row) => {
      const cells = (row.children ?? []).filter((child) => ["TH", "TD"].includes(child.role ?? ""));
      return cells.map((cell) => {
        const ids = contentIds(cell);
        ids.forEach((id) => tableIds.add(id));
        const cellItems = ids.flatMap((id) => groupedItems.get(id) ?? []);
        return {
          content: inlineContentForItems(cellItems, cell.role === "TH"),
          items: cellItems,
          type: cell.role,
        };
      });
    });
    const columnCount = Math.max(0, ...rows.map((row) => row.length));
    if (rows.length === 0 || columnCount < 2) continue;
    tableIds.forEach((id) => usedIds.add(id));
    const headerRows = rows.filter(
      (row) => row.length > 0 && row.every((cell) => cell.type === "TH"),
    );
    const y = Math.max(
      0,
      ...rows.flatMap((row) =>
        row.flatMap((cell) =>
          cell.items.flatMap((item) =>
            item && typeof item === "object" && "transform" in item
              ? [Number((item as { transform: number[] }).transform[5] ?? 0)]
              : [],
          ),
        ),
      ),
    );
    elements.push({
      y,
      block: {
        id: crypto.randomUUID(),
        type: "table",
        props: {},
        content: {
          type: "tableContent",
          columnWidths: Array.from({ length: columnCount }, () => null),
          ...(headerRows.length ? { headerRows: headerRows.length } : {}),
          rows: rows.map((row) => ({
            cells: Array.from({ length: columnCount }, (_, index) => ({
              type: "tableCell" as const,
              props: {},
              content: row[index]?.content ?? [],
            })),
          })),
        },
        children: [],
      },
    });
  }

  const remainingItems: unknown[] = [];
  const stack: string[] = [];
  for (const item of items) {
    if (item && typeof item === "object" && "type" in item) {
      if (item.type === "beginMarkedContentProps") {
        stack.push("id" in item && typeof item.id === "string" ? item.id : "");
        continue;
      }
      if (item.type === "endMarkedContent") {
        stack.pop();
        continue;
      }
    }
    if (!stack.some((id) => usedIds.has(id))) remainingItems.push(item);
  }
  return { elements, remainingItems };
};

const stripListMarker = (content: DocumentInlineContent[], pattern: RegExp) => {
  for (const item of content) {
    if (item.type !== "text" || !item.text) continue;
    item.text = item.text.replace(pattern, "");
    break;
  }
  return content.filter((item) => item.type !== "text" || item.text.length > 0);
};

const appendLine = (block: DocumentBlock, line: PdfLine, normalFont: string) => {
  const next = lineContent(line, normalFont);
  if (!next.length) return;
  const content = Array.isArray(block.content) ? block.content : [];
  if (content.length) content.push({ type: "text", text: " ", styles: {} });
  content.push(...next);
  block.content = content;
};

export const convertPdfTextLines = (items: unknown[]): PdfElement[] => {
  const lines = groupTextLines(items).filter((line) => lineText(line));
  if (!lines.length) return [];
  const bodyHeight = median(lines.map((line) => line.height).filter((height) => height > 0));
  const fontUsage = new Map<string, number>();
  for (const line of lines)
    for (const run of line.runs)
      if (run.height <= bodyHeight * 1.3)
        fontUsage.set(run.fontName, (fontUsage.get(run.fontName) ?? 0) + run.text.length);
  const normalFont =
    [...fontUsage].sort((left, right) => right[1] - left[1])[0]?.[0] ?? lines[0]!.runs[0]!.fontName;
  const elements: PdfElement[] = [];
  let previousLine: PdfLine | undefined;
  for (const line of lines) {
    const text = lineText(line);
    // Going back up the page (the top of the next column) starts a new context, like a page top.
    const rawGap = previousLine ? previousLine.y - line.y : Number.POSITIVE_INFINITY;
    const gap = rawGap > 0 ? rawGap : Number.POSITIVE_INFINITY;
    const headingRatio = line.height / bodyHeight;
    const bullet = /^[●•▪◦]\s*/.test(text);
    const numbered = /^\d+[.)]\s+/.test(text) && headingRatio < 1.3;
    const allBold = line.runs
      .filter((run) => run.text.trim())
      .every((run) => run.fontName !== normalFont);
    // A bold line reads as a heading only when it is short and does not close like a sentence or
    // a list entry (";", "." or ","); list markers always win over boldness.
    const standaloneBold =
      allBold && !bullet && text.length <= 80 && !/[.;,]$/.test(text) && gap > bodyHeight * 1.65;
    let block: DocumentBlock;
    if (headingRatio >= 1.35 || standaloneBold) {
      const level = headingRatio >= 2 ? 1 : headingRatio >= 1.5 ? 2 : 3;
      block = {
        id: crypto.randomUUID(),
        type: "heading",
        props: { level },
        content: lineContent(line, normalFont),
        children: [],
      };
    } else if (bullet || numbered) {
      block = {
        id: crypto.randomUUID(),
        type: bullet ? "bulletListItem" : "numberedListItem",
        props: {},
        content: stripListMarker(
          lineContent(line, normalFont),
          bullet ? /^[●•▪◦]\s*/ : /^\d+[.)]\s+/,
        ),
        children: [],
      };
    } else {
      const previous = elements.at(-1)?.block;
      const continuesPrevious =
        previousLine &&
        gap <= bodyHeight * 1.65 &&
        previous &&
        ["paragraph", "bulletListItem", "numberedListItem"].includes(previous.type);
      if (continuesPrevious) {
        appendLine(previous, line, normalFont);
        previousLine = line;
        continue;
      }
      block = {
        id: crypto.randomUUID(),
        type: "paragraph",
        props: {},
        content: lineContent(line, normalFont),
        children: [],
      };
    }
    elements.push({ block, y: line.y });
    previousLine = line;
  }
  return elements;
};

/**
 * Some PDFs (diagram tools, slide exports) draw shadows and soft edges as a separate grayscale
 * layer meant to be a transparency mask. Without that mask applied it reads as a black box with a
 * blurred white shape, and it carries no content: the shapes and text are vectors and text.
 * Pattern: every pixel gray, the four corners black, the center white.
 */
export const isSoftMaskLayer = (image: PdfImage) => {
  if (!image.data || image.width < 8 || image.height < 8) return false;
  const channels =
    image.kind === ImageKind.RGBA_32BPP ? 4 : image.kind === ImageKind.RGB_24BPP ? 3 : 0;
  if (!channels) return false;
  const data = image.data;
  const luminance = (x: number, y: number) => {
    const offset = (y * image.width + x) * channels;
    return (data[offset]! + data[offset + 1]! + data[offset + 2]!) / 3;
  };
  const corners = [
    luminance(0, 0),
    luminance(image.width - 1, 0),
    luminance(0, image.height - 1),
    luminance(image.width - 1, image.height - 1),
  ];
  if (corners.some((value) => value > 16)) return false;
  if (luminance(image.width >> 1, image.height >> 1) < 240) return false;
  const pixels = image.width * image.height;
  const step = Math.max(1, Math.floor(pixels / 4_000));
  for (let index = 0; index < pixels; index += step) {
    const offset = index * channels;
    const [red, green, blue] = [data[offset]!, data[offset + 1]!, data[offset + 2]!];
    if (Math.abs(red - green) > 6 || Math.abs(green - blue) > 6) return false;
  }
  return true;
};

/**
 * A PDF image as a file the editor can show. Photos are usually JPEG inside the PDF: kept as JPEG
 * they stay small, while a PNG of the same photo is several times larger and a document full of
 * them hit the import's size limit (images were then dropped). Flat images (diagrams, text) keep
 * PNG when it is not much larger, so they stay sharp; transparency always keeps PNG.
 */
const encodePdfImage = async (
  image: PdfImage,
): Promise<{ bytes: Uint8Array; mimeType: string } | null> => {
  if (!image.data || image.width <= 0 || image.height <= 0) return null;
  if (![ImageKind.RGB_24BPP, ImageKind.RGBA_32BPP].includes(image.kind ?? -1)) return null;
  const pixelCount = image.width * image.height;
  if (pixelCount > 20_000_000) return null;
  const channels = image.kind === ImageKind.RGBA_32BPP ? 4 : 3;
  if (image.data.length < pixelCount * channels) return null;
  const raw = sharp(Buffer.from(image.data.buffer, image.data.byteOffset, pixelCount * channels), {
    raw: { channels, height: image.height, width: image.width },
  });
  const png = await raw.clone().png({ compressionLevel: 9 }).toBuffer();
  if (channels === 4) return { bytes: new Uint8Array(png), mimeType: "image/png" };
  const jpeg = await raw.clone().jpeg({ mozjpeg: true, quality: 85 }).toBuffer();
  return png.byteLength <= jpeg.byteLength * 1.25
    ? { bytes: new Uint8Array(png), mimeType: "image/png" }
    : { bytes: new Uint8Array(jpeg), mimeType: "image/jpeg" };
};

const imageTop = (matrix: Matrix) =>
  Math.max(
    matrix[5],
    matrix[1] + matrix[5],
    matrix[3] + matrix[5],
    matrix[1] + matrix[3] + matrix[5],
  );

export const resolvePdfImageObject = (
  page: { commonObjs: PdfObjectPool; objs: PdfObjectPool },
  name: string,
) =>
  new Promise<PdfImage | null>((resolve) => {
    let settled = false;
    const finish = (image: PdfImage | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(image);
    };
    const timeout = setTimeout(() => finish(null), PDF_IMAGE_RESOLUTION_TIMEOUT_MS);
    try {
      const pool = name.startsWith("g_") ? page.commonObjs : page.objs;
      pool.get(name, finish);
    } catch {
      finish(null);
    }
  });

const extractPageVisuals = async (
  page: {
    getOperatorList: () => Promise<{ argsArray: unknown[][]; fnArray: number[] }>;
    commonObjs: PdfObjectPool;
    objs: PdfObjectPool;
  },
  imageLimit: number,
) => {
  const operators = await page.getOperatorList();
  const elements: Array<{ name: string; y: number }> = [];
  const textColors: string[] = [];
  let operatorText = "";
  let fillColor = "#000000";
  const stack: Matrix[] = [];
  let matrix: Matrix = [1, 0, 0, 1, 0, 0];
  for (let index = 0; index < operators.fnArray.length; index += 1) {
    const operation = operators.fnArray[index];
    const args = operators.argsArray[index];
    if (operation === OPS.save) stack.push([...matrix]);
    else if (operation === OPS.restore) matrix = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (operation === OPS.transform && args?.length === 6)
      matrix = multiplyMatrices(matrix, args.map(Number) as Matrix);
    else if (operation === OPS.setFillRGBColor && typeof args?.[0] === "string")
      fillColor = args[0];
    else if (operation === OPS.showText && Array.isArray(args?.[0])) {
      const text = (args[0] as Array<number | { unicode?: string }>)
        .map((glyph) => (typeof glyph === "number" ? "" : (glyph.unicode ?? "")))
        .join("");
      operatorText += text;
      textColors.push(...Array.from(text, () => fillColor));
    } else if (operation === OPS.paintImageXObject && typeof args?.[0] === "string")
      elements.push({ name: args[0], y: imageTop(matrix) });
  }
  const limitedElements = elements.slice(0, imageLimit);
  const imageByName = new Map<string, Promise<PdfImage | null>>();
  for (const { name } of limitedElements) {
    if (imageByName.has(name)) continue;
    imageByName.set(name, resolvePdfImageObject(page, name));
  }
  const images = await Promise.all(
    limitedElements.map(async ({ name, y }) => ({
      image: await imageByName.get(name)!,
      global: name.startsWith("g_"),
      name,
      y,
    })),
  );
  return {
    images,
    operatorText,
    skippedImages: Math.max(0, elements.length - limitedElements.length),
    textColors,
  };
};

const applyTextColors = (items: unknown[], operatorText: string, colors: string[]) => {
  const extractedText = items
    .map((item) => (item && typeof item === "object" && "str" in item ? String(item.str) : ""))
    .join("");
  if (extractedText !== operatorText || colors.length !== Array.from(operatorText).length)
    return items;
  let offset = 0;
  return items.map((item) => {
    if (!item || typeof item !== "object" || !("str" in item)) return item;
    const text = String(item.str);
    const length = Array.from(text).length;
    const itemColors = colors.slice(offset, offset + length);
    offset += length;
    const usage = new Map<string, number>();
    for (const color of itemColors) usage.set(color, (usage.get(color) ?? 0) + 1);
    const textColor = [...usage].sort((left, right) => right[1] - left[1])[0]?.[0];
    return textColor ? { ...item, textColor } : item;
  });
};

export const convertPdfDocument = async (
  bytes: Uint8Array,
  onProgress: (current: number, total: number) => Promise<void>,
) => {
  const loadingTask = getDocument({ data: bytes, disableFontFace: true, useSystemFonts: false });
  const pdf = await loadingTask.promise;
  if (pdf.numPages > DOCUMENT_IMPORT_MAX_PDF_PAGES)
    throw new PdfImportError("PDF_PAGE_LIMIT_EXCEEDED");
  const blocks: DocumentBlock[] = [];
  const assets: PdfAsset[] = [];
  const warnings: string[] = [];
  let assetBytes = 0;
  let skippedImages = 0;
  let observedImages = 0;
  const importedImages = new Map<string, string | null>();
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent({ includeMarkedContent: true });
      const structure = (await page.getStructTree()) as PdfStructureNode | null;
      const visuals = await extractPageVisuals(
        page as never,
        Math.max(0, PDF_MAX_EXTRACTED_IMAGES - observedImages),
      );
      observedImages += visuals.images.length;
      skippedImages += visuals.skippedImages;
      const coloredItems = applyTextColors(content.items, visuals.operatorText, visuals.textColors);
      const structured = extractStructuredPdfTables(coloredItems, structure);
      // Text keeps its reading order (columns included); tables and images are placed into it by height.
      const textElements = convertPdfTextLines(structured.remainingItems);
      const elements: PdfElement[] = [...structured.elements];
      for (const { global, image, name, y } of visuals.images) {
        const imageKey = global ? `global:${name}` : `page:${pageNumber}:${name}`;
        let id = importedImages.get(imageKey);
        if (id === undefined) {
          // Decorative mask layers are dropped silently: they are not content the user lost.
          if (image && isSoftMaskLayer(image)) {
            importedImages.set(imageKey, null);
            continue;
          }
          const encoded = image ? await encodePdfImage(image).catch(() => null) : null;
          if (
            !encoded ||
            encoded.bytes.byteLength > IMAGE_MAX_BYTES ||
            assetBytes + encoded.bytes.byteLength > DOCUMENT_IMPORT_BINARY_MAX_BYTES
          ) {
            importedImages.set(imageKey, null);
            skippedImages += 1;
            continue;
          }
          id = crypto.randomUUID();
          importedImages.set(imageKey, id);
          assetBytes += encoded.bytes.byteLength;
          assets.push({ id, mimeType: encoded.mimeType, bytes: encoded.bytes });
        }
        if (!id) continue;
        elements.push({
          y,
          block: {
            id: crypto.randomUUID(),
            type: "image",
            props: { url: `/api/assets/${id}/content`, name: "Imagem importada do PDF" },
            children: [],
          },
        });
      }
      blocks.push(...placeByPosition(textElements, elements).map(({ block }) => block));
      if (pageNumber < pdf.numPages)
        blocks.push({ id: crypto.randomUUID(), type: "divider", props: {}, children: [] });
      await onProgress(pageNumber, pdf.numPages);
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
  if (skippedImages)
    warnings.push(
      `${skippedImages} imagem${skippedImages > 1 ? "s" : ""} do PDF não puderam ser importadas.`,
    );
  const pending = [...blocks];
  let hasText = false;
  while (pending.length && !hasText) {
    const block = pending.pop()!;
    if (block.type !== "image" && getDocumentBlockText(block).trim()) hasText = true;
    if (block.children) pending.push(...block.children);
  }
  if (!hasText) throw new PdfImportError("PDF_WITHOUT_TEXT");
  return { blocks, assets, warnings };
};
