import { API_URL, apiRequest } from "@/lib/api-client.ts";

const resolvedAssetUrls = new Map<string, string>();

export const resolveAssetUrl = async (url: string) => {
  if (!url.startsWith("/api/assets/")) return url;
  const cached = resolvedAssetUrls.get(url);
  if (cached) return cached;
  const response = await fetch(`${API_URL}${url}`, { credentials: "include" });
  if (!response.ok) throw new Error("Não foi possível carregar a imagem.");
  const resolved = URL.createObjectURL(await response.blob());
  resolvedAssetUrls.set(url, resolved);
  return resolved;
};

export const releaseResolvedAssetUrls = () => {
  for (const url of resolvedAssetUrls.values()) URL.revokeObjectURL(url);
  resolvedAssetUrls.clear();
};

export const removeAssetByUrl = (url: string): Promise<void> => {
  const match = /^\/api\/assets\/([0-9a-f-]{36})\/content$/i.exec(url);
  return match
    ? apiRequest(`/api/assets/${match[1]}`, null, { method: "DELETE" })
    : Promise.resolve();
};
