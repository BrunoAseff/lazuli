import { createContext, useContext } from "react";

export const DocumentImportContext = createContext<{
  openImportDialog: (projectId: string, parentId: string | null) => void;
} | null>(null);

export function useDocumentImports() {
  const context = useContext(DocumentImportContext);
  if (!context) throw new Error("useDocumentImports must be used inside DocumentImportProvider");
  return context;
}
