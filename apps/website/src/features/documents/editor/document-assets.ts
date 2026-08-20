import { removeAssetByUrl } from "../api/document-api.ts";
import type { LazuliDocumentBlock } from "./document-schema.tsx";

export const collectAssetUrls = (blocks: LazuliDocumentBlock) => {
  const urls = new Set<string>();
  const pending = [...blocks];
  while (pending.length) {
    const block = pending.pop()!;
    if (block.type === "image" && block.props.url.startsWith("/api/assets/"))
      urls.add(block.props.url);
    pending.push(...block.children);
  }
  return urls;
};

export const cleanupAssets = async (urls: string[]) => {
  const results = await Promise.allSettled(urls.map((url) => removeAssetByUrl(url)));
  return urls.filter((_, index) => results[index]?.status === "rejected");
};
