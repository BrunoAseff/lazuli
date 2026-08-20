import {
  assetResponseSchema,
  type AssetResponse,
  type CreateProjectItemInput,
  type DocumentResponse,
  documentResponseSchema,
  type ProjectTreeItem,
  type ProjectTreeResponse,
  projectTreeItemSchema,
  projectTreeResponseSchema,
  type SaveDocumentContentInput,
  type UpdateProjectItemInput,
} from "@lazuli/shared";
import { z } from "zod";

import { API_URL, apiRequest } from "@/lib/api-client.ts";

const path = (projectId: string) => `/api/projects/${encodeURIComponent(projectId)}`;
export const fetchProjectTree = (
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectTreeResponse> =>
  apiRequest(`${path(projectId)}/tree`, projectTreeResponseSchema, { signal });
export const postProjectItem = (
  projectId: string,
  input: CreateProjectItemInput,
): Promise<ProjectTreeItem> =>
  apiRequest(`${path(projectId)}/items`, projectTreeItemSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
export const patchProjectItem = (
  projectId: string,
  itemId: string,
  input: UpdateProjectItemInput,
): Promise<ProjectTreeItem> =>
  apiRequest(`${path(projectId)}/items/${encodeURIComponent(itemId)}`, projectTreeItemSchema, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
export const removeProjectItem = (projectId: string, itemId: string): Promise<void> =>
  apiRequest(`${path(projectId)}/items/${encodeURIComponent(itemId)}`, null, { method: "DELETE" });
export const fetchDocument = (
  projectId: string,
  documentId: string,
  signal?: AbortSignal,
): Promise<DocumentResponse> =>
  apiRequest(
    `${path(projectId)}/documents/${encodeURIComponent(documentId)}`,
    documentResponseSchema,
    { signal },
  );
const saveResponseSchema = z.object({
  revision: z.number().int().positive(),
  updatedAt: z.iso.datetime(),
});
export const putDocumentContent = (
  projectId: string,
  documentId: string,
  input: SaveDocumentContentInput,
) =>
  apiRequest(
    `${path(projectId)}/documents/${encodeURIComponent(documentId)}/content`,
    saveResponseSchema,
    { method: "PUT", body: JSON.stringify(input) },
  );
export const uploadDocumentImage = async (
  projectId: string,
  documentId: string,
  file: File,
): Promise<AssetResponse> => {
  const form = new FormData();
  form.set("file", file);
  return apiRequest(
    `${path(projectId)}/documents/${encodeURIComponent(documentId)}/assets/images`,
    assetResponseSchema,
    { method: "POST", body: form },
  );
};
export const importDocumentImage = (
  projectId: string,
  documentId: string,
  url: string,
): Promise<AssetResponse> =>
  apiRequest(
    `${path(projectId)}/documents/${encodeURIComponent(documentId)}/assets/images/import`,
    assetResponseSchema,
    { method: "POST", body: JSON.stringify({ url }) },
  );
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
