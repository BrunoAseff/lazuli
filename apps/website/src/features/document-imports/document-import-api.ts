import {
  createDocumentImportSchema,
  type DocumentImport,
  documentImportListSchema,
  documentImportSchema,
  storageUsageSchema,
} from "@lazuli/shared";

import { API_URL, apiRequest, ApiError } from "@/lib/api-client.ts";

const activeUploadRequests = new Map<string, XMLHttpRequest>();

export const fetchDocumentImports = () =>
  apiRequest("/api/document-imports", documentImportListSchema);
export const fetchStorageUsage = () => apiRequest("/api/storage/usage", storageUsageSchema);
export const createDocumentImport = (
  projectId: string,
  input: Parameters<typeof createDocumentImportSchema.parse>[0],
) =>
  apiRequest(
    `/api/projects/${encodeURIComponent(projectId)}/document-imports`,
    documentImportSchema,
    { method: "POST", body: JSON.stringify(createDocumentImportSchema.parse(input)) },
  );
export const uploadDocumentImport = async (
  projectId: string,
  importId: string,
  file: File,
  onProgress?: (loaded: number, total: number) => void,
): Promise<DocumentImport> => {
  const form = new FormData();
  form.set("file", file, file.name);
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    activeUploadRequests.set(importId, request);
    request.open(
      "PUT",
      `${API_URL}/api/projects/${encodeURIComponent(projectId)}/document-imports/${encodeURIComponent(importId)}/file`,
    );
    request.withCredentials = true;
    request.upload.onprogress = (event) => onProgress?.(event.loaded, event.total || file.size);
    request.onerror = () => {
      activeUploadRequests.delete(importId);
      reject(new ApiError(0, "NETWORK_ERROR"));
    };
    request.onabort = () => {
      activeUploadRequests.delete(importId);
      reject(new ApiError(0, "UPLOAD_CANCELED"));
    };
    request.onload = () => {
      activeUploadRequests.delete(importId);
      let payload: unknown = null;
      try {
        payload = JSON.parse(request.responseText || "null") as unknown;
      } catch {
        reject(new ApiError(request.status, "INVALID_API_RESPONSE"));
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        const code =
          payload && typeof payload === "object" && "code" in payload
            ? String(payload.code)
            : undefined;
        reject(new ApiError(request.status, code, payload));
        return;
      }
      const parsed = documentImportSchema.safeParse(payload);
      if (!parsed.success) reject(parsed.error);
      else resolve(parsed.data);
    };
    request.send(form);
  });
};
export const abortDocumentImportUpload = (importId: string) =>
  activeUploadRequests.get(importId)?.abort();
export const cancelDocumentImport = (importId: string) =>
  apiRequest(`/api/document-imports/${encodeURIComponent(importId)}/cancel`, documentImportSchema, {
    method: "POST",
  });
export const retryDocumentImport = (importId: string) =>
  apiRequest(`/api/document-imports/${encodeURIComponent(importId)}/retry`, documentImportSchema, {
    method: "POST",
  });

export const acceptedDocumentImportTypes =
  ".md,.markdown,.txt,.docx,.pdf,text/markdown,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const inferImportMimeType = (file: File) => {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf" as const;
  if (name.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const;
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "text/markdown" as const;
  if (name.endsWith(".txt")) return "text/plain" as const;
  return null;
};
