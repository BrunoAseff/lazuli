import { DOCUMENT_IMPORT_ACTIVE_STATUSES, type DocumentImport } from "@lazuli/shared";

const activeImportStatuses = new Set<DocumentImport["status"]>(DOCUMENT_IMPORT_ACTIVE_STATUSES);

export const isDocumentImportActive = (item: DocumentImport) =>
  activeImportStatuses.has(item.status);

export const getVisibleDocumentImports = (
  imports: DocumentImport[],
  completedDismissedAt: number,
  limit = 10,
) => {
  const active = imports.filter(isDocumentImportActive);
  const terminal = imports.filter((item) => {
    if (!item.finishedAt || !["completed", "failed"].includes(item.status)) return false;
    return new Date(item.finishedAt).getTime() > completedDismissedAt;
  });
  return [...active, ...terminal].slice(0, limit);
};
