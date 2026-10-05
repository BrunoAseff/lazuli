import type { DocumentBlock } from "../documents/document-contracts.ts";
import { readSourceAnchorId } from "../documents/source-anchor.ts";

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

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
    const inline = block.content ?? [];
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
      return { anchorId: existingAnchor, changed: false, content: items, kind: "ok" };
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
    const nextInline: NonNullable<DocumentBlock["content"]> = [];
    for (const item of inline) {
      if (item.type === "text") nextInline.push(...mapText(item));
      else
        nextInline.push({
          ...item,
          content: item.content.flatMap((text) => mapText(text)),
        });
    }
    const content = [...items];
    content[blockIndex] = { ...block, content: nextInline };
    return { anchorId: reference.anchorId, changed: true, content, kind: "ok" };
  };
  return visit(blocks);
};

export const getDocumentBlockText = (block: DocumentBlock) =>
  normalizeText(
    (block.content ?? [])
      .flatMap((item) =>
        item.type === "text" ? [item.text] : [item.content.map(({ text }) => text).join("")],
      )
      .join(""),
  );

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
    for (const item of block.content ?? []) {
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
    for (const item of block.content ?? []) {
      const texts = item.type === "text" ? [item] : item.content;
      for (const text of texts) {
        if (!anchorId || readSourceAnchorId(text.styles) === anchorId) fragments.push(text.text);
      }
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
      content: block.content?.map((item) =>
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
