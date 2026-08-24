import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DOCUMENT_IMPORT_BINARY_MAX_BYTES,
  DOCUMENT_IMPORT_MARKDOWN_MAX_BYTES,
  DOCUMENT_IMPORT_MAX_ACTIVE,
} from "@lazuli/shared";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { documentKeys } from "@/features/documents/api/document-queries.ts";
import { projectKeys } from "@/features/projects/api/project-queries.ts";
import {
  cancelDocumentImport,
  createDocumentImport,
  fetchDocumentImports,
  fetchStorageUsage,
  inferImportMimeType,
  uploadDocumentImport,
} from "./document-import-api.ts";
import { collectNewlyCompletedImports } from "./document-import-completion-tracker.ts";
import { DocumentImportTray } from "./document-import-tray.tsx";
import { DocumentImportDialog, type PreparedImportFile } from "./document-import-dialog.tsx";
import { isDocumentImportActive } from "./document-import-visibility.ts";
import { ApiError } from "@/lib/api-client.ts";

export const importKeys = {
  list: ["document-imports"] as const,
  storage: ["storage-usage"] as const,
};

type ImportContextValue = {
  openImportDialog: (projectId: string, parentId: string | null) => void;
};
const ImportContext = createContext<ImportContextValue | null>(null);

export const DocumentImportProvider = ({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string;
}) => {
  const client = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [dialogTarget, setDialogTarget] = useState<{
    projectId: string;
    parentId: string | null;
  } | null>(null);
  const trackedImportIds = useRef(new Set<string>());
  const imports = useQuery({
    queryKey: importKeys.list,
    queryFn: fetchDocumentImports,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.imports.some(isDocumentImportActive) ? 1_500 : false,
  });
  const storage = useQuery({ queryKey: importKeys.storage, queryFn: fetchStorageUsage });
  useEffect(() => {
    if (imports.isError) {
      toast.error("Não foi possível carregar o andamento das importações.", {
        id: "document-import-status-error",
      });
      return;
    }
    toast.dismiss("document-import-status-error");
  }, [imports.isError]);
  const importFiles = useCallback(
    async (projectId: string, parentId: string | null, files: PreparedImportFile[]) => {
      if (files.length > DOCUMENT_IMPORT_MAX_ACTIVE)
        toast.warning(`Importaremos somente os primeiros ${DOCUMENT_IMPORT_MAX_ACTIVE} arquivos.`);
      for (const prepared of files.slice(0, DOCUMENT_IMPORT_MAX_ACTIVE)) {
        const { file, originalName } = prepared;
        const mimeType = inferImportMimeType(file);
        if (!mimeType) {
          toast.error(`${originalName}: formato não suportado.`);
          continue;
        }
        const maxBytes =
          mimeType === "text/markdown" || mimeType === "text/plain"
            ? DOCUMENT_IMPORT_MARKDOWN_MAX_BYTES
            : DOCUMENT_IMPORT_BINARY_MAX_BYTES;
        if (file.size === 0) {
          toast.error(`${originalName}: o arquivo está vazio.`);
          continue;
        }
        if (file.size > maxBytes) {
          toast.error(
            `${originalName}: o limite é ${Math.round(maxBytes / 1024 / 1024)} MB para este formato.`,
          );
          continue;
        }
        const id = crypto.randomUUID();
        let sessionCreated = false;
        try {
          await createDocumentImport(projectId, {
            id,
            documentId: crypto.randomUUID(),
            parentId,
            originalName,
            mimeType,
            byteSize: file.size,
          });
          trackedImportIds.current.add(id);
          sessionCreated = true;
          await client.invalidateQueries({ queryKey: importKeys.list });
          await uploadDocumentImport(projectId, id, file, (loaded, total) =>
            setUploadProgress((current) => ({
              ...current,
              [id]: Math.round((loaded / total) * 100),
            })),
          );
          await client.invalidateQueries({ queryKey: importKeys.list });
        } catch (error) {
          if (error instanceof ApiError && error.code === "UPLOAD_CANCELED") {
            await client.invalidateQueries({ queryKey: importKeys.list });
            continue;
          }
          if (sessionCreated) await cancelDocumentImport(id).catch(() => undefined);
          const message =
            error instanceof ApiError &&
            error.payload &&
            typeof error.payload === "object" &&
            "message" in error.payload &&
            typeof error.payload.message === "string"
              ? error.payload.message
              : `Não foi possível importar “${originalName}”.`;
          toast.error(message);
          await client.invalidateQueries({ queryKey: importKeys.list });
        } finally {
          setUploadProgress((current) => {
            const next = { ...current };
            delete next[id];
            return next;
          });
        }
      }
    },
    [client],
  );
  useEffect(() => {
    if (!imports.data) return;
    const completed = collectNewlyCompletedImports(imports.data.imports, trackedImportIds.current);
    if (!completed.length) return;
    const projectIds = new Set(completed.map((item) => item.projectId));
    for (const projectId of projectIds) {
      void client.invalidateQueries({ queryKey: documentKeys.tree(projectId) });
      void client.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      void client.invalidateQueries({ queryKey: projectKeys.projectDocuments(projectId) });
    }
    void client.invalidateQueries({ queryKey: importKeys.storage });
  }, [client, imports.data]);

  const value = useMemo(
    () => ({
      openImportDialog: (projectId: string, parentId: string | null) =>
        setDialogTarget({ projectId, parentId }),
    }),
    [],
  );
  return (
    <ImportContext.Provider value={value}>
      {children}
      <DocumentImportDialog
        onOpenChange={(open) => !open && setDialogTarget(null)}
        onSubmit={(files) => {
          if (dialogTarget) void importFiles(dialogTarget.projectId, dialogTarget.parentId, files);
        }}
        open={Boolean(dialogTarget)}
      />
      <DocumentImportTray
        imports={imports.data?.imports ?? []}
        storage={storage.data}
        uploadProgress={uploadProgress}
        userId={userId}
      />
    </ImportContext.Provider>
  );
};

export const useDocumentImports = () => {
  const context = useContext(ImportContext);
  if (!context) throw new Error("useDocumentImports must be used inside DocumentImportProvider");
  return context;
};
