import type { DocumentBlock } from "../documents/document-contracts.ts";
import { readSourceAnchorId } from "../documents/source-anchor.ts";

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

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
