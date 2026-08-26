type RichBlock = {
  type?: unknown;
  props?: Record<string, unknown>;
  content?: Array<
    { type: "text"; text: string } | { type: "link"; content: Array<{ text: string }> }
  >;
  children?: RichBlock[];
};

export const summarizeRichContent = (content: unknown[]) => {
  const text: string[] = [];
  const assetIds = new Set<string>();
  const pending = [...(content as RichBlock[])];
  let hasImage = false;
  while (pending.length) {
    const block = pending.shift()!;
    if (block.type === "image") {
      hasImage = true;
      const url = block.props?.url;
      if (typeof url === "string") {
        const match = /^\/api\/assets\/([0-9a-f-]{36})\/content$/i.exec(url);
        if (match?.[1]) assetIds.add(match[1]);
      }
    }
    for (const item of block.content ?? []) {
      if (item.type === "text") text.push(item.text);
      else text.push(...item.content.map(({ text: value }) => value));
    }
    if (block.children) pending.unshift(...block.children);
  }
  return { assetIds: [...assetIds], hasImage, text: text.join(" ").replace(/\s+/g, " ").trim() };
};
