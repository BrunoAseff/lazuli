import {
  DOCUMENT_IMPORT_BINARY_MAX_BYTES,
  DOCUMENT_IMPORT_MAX_PDF_PAGES,
  IMAGE_MAX_BYTES,
  type DocumentBlock,
} from "@lazuli/shared";
import { getDocument, ImageKind, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PNG } from "pngjs";

type PdfRun = {
  color?: string;
  fontName: string;
  height: number;
  text: string;
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
type Matrix = [number, number, number, number, number, number];
type PdfObjectPool = { get: (name: string, callback: (image: PdfImage) => void) => void };
type TextContent = Extract<NonNullable<DocumentBlock["content"]>[number], { type: "text" }>;

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
    if (!item.str) continue;
    const run: PdfRun = {
      color: item.textColor,
      fontName: item.fontName,
      height: Math.abs(item.height || item.transform[3] || 0),
      text: item.str,
      width: item.width,
      x: item.transform[4] ?? 0,
      y: item.transform[5] ?? 0,
    };
    let line = lines.find(
      (current) => Math.abs(current.y - run.y) <= Math.max(1.5, run.height * 0.12),
    );
    if (!line) {
      line = { height: run.height, runs: [], x: run.x, y: run.y };
      lines.push(line);
    }
    line.runs.push(run);
    line.height = Math.max(line.height, run.height);
    line.x = Math.min(line.x, run.x);
  }
  for (const line of lines) line.runs.sort((left, right) => left.x - right.x);
  return lines.sort((left, right) => right.y - left.y || left.x - right.x);
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

const stripListMarker = (content: NonNullable<DocumentBlock["content"]>, pattern: RegExp) => {
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
  const content = (block.content ??= []);
  if (content.length) content.push({ type: "text", text: " ", styles: {} });
  content.push(...next);
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
    const gap = previousLine ? previousLine.y - line.y : Number.POSITIVE_INFINITY;
    const headingRatio = line.height / bodyHeight;
    const bullet = /^[●•▪◦]\s*/.test(text);
    const numbered = /^\d+[.)]\s+/.test(text) && headingRatio < 1.3;
    const allBold = line.runs
      .filter((run) => run.text.trim())
      .every((run) => run.fontName !== normalFont);
    const standaloneBold = allBold && text.length <= 100 && gap > bodyHeight * 1.65;
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

const encodePdfImage = (image: PdfImage) => {
  if (!image.data || image.width <= 0 || image.height <= 0) return null;
  if (![ImageKind.RGB_24BPP, ImageKind.RGBA_32BPP].includes(image.kind ?? -1)) return null;
  const pixelCount = image.width * image.height;
  if (pixelCount > 20_000_000) return null;
  const channels = image.kind === ImageKind.RGBA_32BPP ? 4 : 3;
  if (image.data.length < pixelCount * channels) return null;
  const png = new PNG({ width: image.width, height: image.height });
  for (let source = 0, target = 0; target < png.data.length; source += channels, target += 4) {
    png.data[target] = image.data[source]!;
    png.data[target + 1] = image.data[source + 1]!;
    png.data[target + 2] = image.data[source + 2]!;
    png.data[target + 3] = channels === 4 ? image.data[source + 3]! : 255;
  }
  return new Uint8Array(PNG.sync.write(png));
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
      const content = await page.getTextContent();
      const visuals = await extractPageVisuals(
        page as never,
        Math.max(0, PDF_MAX_EXTRACTED_IMAGES - observedImages),
      );
      observedImages += visuals.images.length;
      skippedImages += visuals.skippedImages;
      const elements = convertPdfTextLines(
        applyTextColors(content.items, visuals.operatorText, visuals.textColors),
      );
      for (const { global, image, name, y } of visuals.images) {
        const imageKey = global ? `global:${name}` : `page:${pageNumber}:${name}`;
        let id = importedImages.get(imageKey);
        if (id === undefined) {
          const encoded = image ? encodePdfImage(image) : null;
          if (
            !encoded ||
            encoded.byteLength > IMAGE_MAX_BYTES ||
            assetBytes + encoded.byteLength > DOCUMENT_IMPORT_BINARY_MAX_BYTES
          ) {
            importedImages.set(imageKey, null);
            skippedImages += 1;
            continue;
          }
          id = crypto.randomUUID();
          importedImages.set(imageKey, id);
          assetBytes += encoded.byteLength;
          assets.push({ id, mimeType: "image/png", bytes: encoded });
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
      blocks.push(...elements.sort((left, right) => right.y - left.y).map(({ block }) => block));
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
  if (
    !blocks.some((block) =>
      block.content?.some((content) => content.type === "text" && content.text.trim()),
    )
  )
    throw new PdfImportError("PDF_WITHOUT_TEXT");
  return { blocks, assets, warnings };
};
