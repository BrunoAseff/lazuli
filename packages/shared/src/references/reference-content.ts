import type { DocumentBlock, DocumentInlineContent } from "../documents/document-contracts.ts";
import { readSourceAnchorId } from "../documents/source-anchor.ts";

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

const getInlineText = (inline: DocumentInlineContent[]) =>
  inline
    .flatMap((item) =>
      item.type === "text" ? [item.text] : [item.content.map(({ text }) => text).join("")],
    )
    .join("");

const inlineGroups = (block: DocumentBlock): DocumentInlineContent[][] => {
  if (!block.content) return [];
  if (Array.isArray(block.content)) return [block.content];
  return block.content.rows.flatMap(({ cells }) =>
    cells.map((cell) => (Array.isArray(cell) ? cell : cell.content)),
  );
};

const normalizedTextWithOffsets = (value: string) => {
  let text = "";
  const offsets: number[] = [];
  let whitespacePending = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (/\s/.test(character)) {
      if (text.length) whitespacePending = true;
      continue;
    }
    if (whitespacePending) {
      text += " ";
      offsets.push(index);
      whitespacePending = false;
    }
    text += character;
    offsets.push(index);
  }
  return { offsets, text };
};

export type AddSourceAnchorResult =
  | { anchorId: string; changed: boolean; content: DocumentBlock[]; kind: "ok" }
  | { kind: "ambiguous" | "block-not-found" | "overlap" | "quote-not-found" };

export const addSourceAnchorToQuote = (
  blocks: DocumentBlock[],
  reference: { anchorId: string; blockId: string; quote: string },
): AddSourceAnchorResult => {
  const visit = (items: DocumentBlock[]): AddSourceAnchorResult => {
    const blockIndex = items.findIndex(({ id }) => id === reference.blockId);
    if (blockIndex === -1) {
      for (let index = 0; index < items.length; index += 1) {
        const children = items[index]!.children;
        if (!children) continue;
        const nested = visit(children);
        if (nested.kind !== "block-not-found") {
          if (nested.kind !== "ok") return nested;
          const content = [...items];
          content[index] = { ...items[index]!, children: nested.content };
          return { ...nested, content };
        }
      }
      return { kind: "block-not-found" };
    }

    const block = items[blockIndex]!;
    if (!block.content) return { kind: "quote-not-found" };
    const anchorInline = (
      inline: DocumentInlineContent[],
    ):
      | { anchorId: string; changed: boolean; inline: DocumentInlineContent[]; kind: "ok" }
      | { kind: "ambiguous" | "overlap" | "quote-not-found" } => {
      const segments: Array<{
        end: number;
        start: number;
        styles: Record<string, string | number | boolean | null>;
      }> = [];
      let rawText = "";
      for (const item of inline) {
        const texts = item.type === "text" ? [item] : item.content;
        for (const text of texts) {
          const start = rawText.length;
          rawText += text.text;
          segments.push({ end: rawText.length, start, styles: text.styles });
        }
      }
      const source = normalizedTextWithOffsets(rawText);
      const quote = normalizeText(reference.quote);
      if (!quote) return { kind: "quote-not-found" };
      const normalizedStart = source.text.indexOf(quote);
      if (normalizedStart === -1) return { kind: "quote-not-found" };
      if (source.text.indexOf(quote, normalizedStart + 1) !== -1) return { kind: "ambiguous" };
      const rawStart = source.offsets[normalizedStart]!;
      const rawEnd = source.offsets[normalizedStart + quote.length - 1]! + 1;
      const touched = segments.filter(({ end, start }) => start < rawEnd && end > rawStart);
      const existingAnchors = new Set(
        touched
          .map(({ styles }) => readSourceAnchorId(styles))
          .filter((id): id is string => Boolean(id)),
      );
      if (existingAnchors.size > 1) return { kind: "overlap" };
      const existingAnchor = [...existingAnchors][0];
      if (
        existingAnchor &&
        touched.every(({ styles }) => readSourceAnchorId(styles) === existingAnchor)
      )
        return { anchorId: existingAnchor, changed: false, inline, kind: "ok" };
      if (existingAnchor) return { kind: "overlap" };

      let cursor = 0;
      const mapText = (text: {
        text: string;
        styles: Record<string, string | number | boolean | null>;
        type: "text";
      }) => {
        const start = cursor;
        const end = cursor + text.text.length;
        cursor = end;
        const selectionStart = Math.max(rawStart, start) - start;
        const selectionEnd = Math.min(rawEnd, end) - start;
        if (selectionStart >= selectionEnd) return [text];
        const result: (typeof text)[] = [];
        if (selectionStart > 0) result.push({ ...text, text: text.text.slice(0, selectionStart) });
        result.push({
          ...text,
          text: text.text.slice(selectionStart, selectionEnd),
          styles: { ...text.styles, sourceAnchor: reference.anchorId },
        });
        if (selectionEnd < text.text.length)
          result.push({ ...text, text: text.text.slice(selectionEnd) });
        return result;
      };
      const nextInline: DocumentInlineContent[] = [];
      for (const item of inline) {
        if (item.type === "text") nextInline.push(...mapText(item));
        else
          nextInline.push({
            ...item,
            content: item.content.flatMap((text) => mapText(text)),
          });
      }
      return { anchorId: reference.anchorId, changed: true, inline: nextInline, kind: "ok" };
    };

    if (Array.isArray(block.content)) {
      const anchored = anchorInline(block.content);
      if (anchored.kind !== "ok") return anchored;
      if (!anchored.changed) return { ...anchored, content: items };
      const content = [...items];
      content[blockIndex] = { ...block, content: anchored.inline };
      return { ...anchored, content };
    }

    const matches: Array<{ cellIndex: number; rowIndex: number }> = [];
    for (const [rowIndex, row] of block.content.rows.entries())
      for (const [cellIndex, cell] of row.cells.entries()) {
        const inline = Array.isArray(cell) ? cell : cell.content;
        const cellText = normalizeText(getInlineText(inline));
        const quote = normalizeText(reference.quote);
        if (cellText.includes(quote)) matches.push({ cellIndex, rowIndex });
      }
    if (matches.length === 0) return { kind: "quote-not-found" };
    if (matches.length > 1) return { kind: "ambiguous" };
    const { cellIndex, rowIndex } = matches[0]!;
    const row = block.content.rows[rowIndex]!;
    const cell = row.cells[cellIndex]!;
    const anchored = anchorInline(Array.isArray(cell) ? cell : cell.content);
    if (anchored.kind !== "ok") return anchored;
    if (!anchored.changed) return { ...anchored, content: items };
    const rows = [...block.content.rows];
    const cells = [...row.cells];
    cells[cellIndex] = Array.isArray(cell)
      ? anchored.inline
      : { ...cell, content: anchored.inline };
    rows[rowIndex] = { ...row, cells };
    const content = [...items];
    content[blockIndex] = { ...block, content: { ...block.content, rows } };
    return { ...anchored, content };
  };
  return visit(blocks);
};

export const getDocumentBlockText = (block: DocumentBlock) =>
  inlineGroups(block)
    .map((content) =>
      normalizeText(
        content
          .flatMap((item) =>
            item.type === "text" ? [item.text] : [item.content.map(({ text }) => text).join("")],
          )
          .join(""),
      ),
    )
    .filter(Boolean)
    .join(" ");

export const collectDocumentTextBlocks = (blocks: DocumentBlock[]) => {
  const result: Array<{ id: string; text: string }> = [];
  const pending = [...blocks].reverse();
  while (pending.length) {
    const block = pending.pop()!;
    const text = getDocumentBlockText(block);
    if (text) result.push({ id: block.id, text });
    if (block.children) pending.push(...[...block.children].reverse());
  }
  return result;
};

export const collectSourceAnchorIds = (blocks: DocumentBlock[]) => {
  const anchors = new Set<string>();
  const pending = [...blocks];
  while (pending.length) {
    const block = pending.pop()!;
    for (const content of inlineGroups(block))
      for (const item of content) {
        if (item.type === "text") {
          const anchorId = readSourceAnchorId(item.styles);
          if (anchorId) anchors.add(anchorId);
        } else
          for (const text of item.content) {
            const anchorId = readSourceAnchorId(text.styles);
            if (anchorId) anchors.add(anchorId);
          }
      }
    if (block.children) pending.push(...block.children);
  }
  return anchors;
};

export const collectReferenceSourceIds = (blocks: DocumentBlock[]) => {
  const sources = collectSourceAnchorIds(blocks);
  const pending = [...blocks];
  while (pending.length) {
    const block = pending.pop()!;
    if (block.type === "image") sources.add(block.id);
    if (block.children) pending.push(...block.children);
  }
  return sources;
};

export const getReferenceSourcePreview = (
  blocks: DocumentBlock[],
  anchorId: string | null,
  maxLength = 500,
) => {
  const blockFragments: string[] = [];
  const pending = [...blocks].reverse();
  while (pending.length) {
    const block = pending.pop()!;
    if (anchorId && block.id === anchorId && block.type === "image") return "Imagem vinculada";
    const fragments: string[] = [];
    for (const content of inlineGroups(block)) {
      const cellFragments: string[] = [];
      for (const item of content) {
        const texts = item.type === "text" ? [item] : item.content;
        for (const text of texts) {
          if (!anchorId || readSourceAnchorId(text.styles) === anchorId)
            cellFragments.push(text.text);
        }
      }
      if (cellFragments.length) fragments.push(cellFragments.join(""));
    }
    const blockText = normalizeText(fragments.join(""));
    if (blockText) blockFragments.push(blockText);
    if (block.children) pending.push(...[...block.children].reverse());
  }
  const preview = normalizeText(blockFragments.join(" "));
  return preview.length > maxLength ? `${preview.slice(0, maxLength).trimEnd()}…` : preview;
};

export const removeSourceAnchors = (blocks: DocumentBlock[], anchorIds: ReadonlySet<string>) => {
  let changed = false;
  const stripStyles = (styles: Record<string, string | number | boolean | null>) => {
    const anchorId = readSourceAnchorId(styles);
    if (!anchorId || !anchorIds.has(anchorId)) return styles;
    changed = true;
    const { sourceAnchor: _removed, ...rest } = styles;
    return rest;
  };
  const visit = (items: DocumentBlock[]): DocumentBlock[] =>
    items.map((block) => ({
      ...block,
      content:
        block.content && !Array.isArray(block.content)
          ? {
              ...block.content,
              rows: block.content.rows.map((row) => ({
                ...row,
                cells: row.cells.map((cell) => {
                  const content = Array.isArray(cell) ? cell : cell.content;
                  const next = content.map((item) =>
                    item.type === "text"
                      ? { ...item, styles: stripStyles(item.styles) }
                      : {
                          ...item,
                          content: item.content.map((text) => ({
                            ...text,
                            styles: stripStyles(text.styles),
                          })),
                        },
                  );
                  return Array.isArray(cell) ? next : { ...cell, content: next };
                }),
              })),
            }
          : block.content?.map((item) =>
              item.type === "text"
                ? { ...item, styles: stripStyles(item.styles) }
                : {
                    ...item,
                    content: item.content.map((text) => ({
                      ...text,
                      styles: stripStyles(text.styles),
                    })),
                  },
            ),
      children: block.children ? visit(block.children) : block.children,
    }));
  const content = visit(blocks);
  return { changed, content: changed ? content : blocks };
};
