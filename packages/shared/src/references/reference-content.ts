import type { DocumentBlock } from "../documents/document-contracts.ts";
import { readSourceAnchorId } from "../documents/source-anchor.ts";

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
  const fragments: string[] = [];
  const pending = [...blocks];
  while (pending.length) {
    const block = pending.shift()!;
    if (anchorId && block.id === anchorId && block.type === "image") return "Imagem vinculada";
    for (const item of block.content ?? []) {
      const texts = item.type === "text" ? [item] : item.content;
      for (const text of texts) {
        if (!anchorId || readSourceAnchorId(text.styles) === anchorId) fragments.push(text.text);
      }
    }
    if (block.children) pending.push(...block.children);
  }
  const preview = fragments.join(" ").replace(/\s+/g, " ").trim();
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
