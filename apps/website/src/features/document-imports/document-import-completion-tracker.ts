import type { DocumentImport } from "@lazuli/shared";

import { isDocumentImportActive } from "./document-import-visibility.ts";

export const collectNewlyCompletedImports = (
  imports: DocumentImport[],
  trackedImportIds: Set<string>,
) => {
  const completed: DocumentImport[] = [];
  for (const item of imports) {
    if (isDocumentImportActive(item)) {
      trackedImportIds.add(item.id);
      continue;
    }
    if (item.status === "completed" && trackedImportIds.delete(item.id)) completed.push(item);
    else if (["failed", "canceled"].includes(item.status)) trackedImportIds.delete(item.id);
  }
  return completed;
};
