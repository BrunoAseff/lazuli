import { removeAssetByUrl } from "./asset-api.ts";

export const collectAssetUrls = (blocks: unknown[]) => {
  const urls = new Set<string>();
  const pending = [...blocks];
  while (pending.length) {
    const block = pending.pop()!;
    if (!block || typeof block !== "object") continue;
    const item = block as { type?: unknown; props?: unknown; children?: unknown };
    const props = item.props as { url?: unknown } | undefined;
    if (
      item.type === "image" &&
      typeof props?.url === "string" &&
      props.url.startsWith("/api/assets/")
    )
      urls.add(props.url);
    if (Array.isArray(item.children)) pending.push(...item.children);
  }
  return urls;
};

export const cleanupAssets = async (urls: string[]) => {
  const results = await Promise.allSettled(urls.map((url) => removeAssetByUrl(url)));
  return urls.filter((_, index) => results[index]?.status === "rejected");
};
