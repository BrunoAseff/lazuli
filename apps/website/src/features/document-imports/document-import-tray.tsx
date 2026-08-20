import type { DocumentImport, StorageUsage } from "@lazuli/shared";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, ChevronDownIcon, FileTextIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  abortDocumentImportUpload,
  cancelDocumentImport,
  retryDocumentImport,
} from "./document-import-api.ts";
import { getVisibleDocumentImports, isDocumentImportActive } from "./document-import-visibility.ts";

const documentImportListKey = ["document-imports"] as const;
const completedDismissedAtStorageKey = (userId: string) =>
  `lazuli-document-imports-completed-dismissed-at:${userId}`;

const failureMessages: Record<string, string> = {
  CONVERTED_DOCUMENT_TOO_LARGE: "O conteúdo convertido excede o limite do editor.",
  IMPORT_CONVERSION_TIMEOUT: "A conversão demorou mais que o permitido.",
  INVALID_DOCX_ARCHIVE: "O arquivo DOCX está corrompido ou incompleto.",
  PDF_PAGE_LIMIT_EXCEEDED: "O PDF possui páginas demais para esta importação.",
  PDF_WITHOUT_TEXT: "Este PDF não possui texto selecionável. OCR ainda não é suportado.",
  STORAGE_LIMIT_REACHED: "Seu limite de armazenamento foi atingido.",
  UNSUPPORTED_DOCUMENT_STRUCTURE: "Parte da estrutura não pôde ser convertida com segurança.",
  UNSAFE_DOCX_ARCHIVE: "O arquivo DOCX excede os limites seguros de descompactação.",
  UNSUPPORTED_FILE_TYPE: "O conteúdo não corresponde a um formato suportado.",
  UPLOAD_EXPIRED: "O envio não foi concluído a tempo.",
};

const statusText = (item: DocumentImport) => {
  if (item.status === "uploading") return "Enviando arquivo…";
  if (item.status === "queued") return "Na fila";
  if (item.status === "processing") {
    if (item.phase === "validating") return "Validando arquivo…";
    if (item.phase === "extracting") return "Extraindo conteúdo…";
    return "Preparando documento…";
  }
  if (item.status === "finalizing") return "Finalizando…";
  if (item.status === "failed")
    return failureMessages[item.errorCode ?? ""] ?? "Não foi possível importar este arquivo.";
  if (item.status === "canceled") return "Importação cancelada";
  return item.warnings.length ? "Concluído com avisos" : "Concluído";
};

export const DocumentImportTray = ({
  imports,
  storage,
  uploadProgress,
  userId,
}: {
  imports: DocumentImport[];
  storage?: StorageUsage;
  uploadProgress: Record<string, number>;
  userId: string;
}) => {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [hiddenThroughImportId, setHiddenThroughImportId] = useState<string | null>(null);
  const [completedDismissedAt, setCompletedDismissedAt] = useState(() => {
    const stored = Number(localStorage.getItem(completedDismissedAtStorageKey(userId)));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  });
  const visible = getVisibleDocumentImports(imports, completedDismissedAt);
  const latestImportId = visible[0]?.id;
  if (!visible.length || latestImportId === hiddenThroughImportId) return null;
  const active = visible.filter(isDocumentImportActive).length;
  const dismissCompleted = () => {
    const dismissedAt = Date.now();
    localStorage.setItem(completedDismissedAtStorageKey(userId), String(dismissedAt));
    setCompletedDismissedAt(dismissedAt);
  };
  return (
    <section className="fixed right-4 bottom-4 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border bg-popover shadow-xl">
      <header className="flex h-12 items-center gap-2 border-b px-4">
        <p className="min-w-0 flex-1 font-medium">
          {active
            ? `${active} importação${active > 1 ? "ões" : ""} em andamento`
            : "Importações concluídas"}
        </p>
        <Button
          aria-label={open ? "Recolher" : "Expandir"}
          onClick={() => setOpen(!open)}
          size="icon-sm"
          variant="ghost"
        >
          <ChevronDownIcon className={open ? "" : "rotate-180"} />
        </Button>
        <Button
          aria-label="Fechar"
          onClick={() => {
            if (!latestImportId) return;
            if (active) setHiddenThroughImportId(latestImportId);
            else dismissCompleted();
          }}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </header>
      {open && (
        <>
          <div className="lazuli-thin-scrollbar max-h-64 overflow-y-auto p-2">
            {visible.map((item) => {
              const total = item.progressTotal ?? 0;
              const value =
                item.status === "uploading"
                  ? uploadProgress[item.id]
                  : total
                    ? ((item.progressCurrent ?? 0) / total) * 100
                    : undefined;
              return (
                <div className="flex gap-3 rounded-md px-2 py-2.5" key={item.id}>
                  <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <OverflowTooltip side="top" text={item.originalName}>
                      {(ref) => (
                        <p
                          className="truncate text-sm font-medium"
                          ref={ref as React.RefObject<HTMLParagraphElement>}
                        >
                          {item.originalName}
                        </p>
                      )}
                    </OverflowTooltip>
                    <p className="text-xs text-muted-foreground">{statusText(item)}</p>
                    {item.warnings.length > 0 && (
                      <p className="mt-1 line-clamp-2 text-xs text-amber-700">
                        {item.warnings[0]}
                        {item.warnings.length > 1 ? ` (+${item.warnings.length - 1})` : ""}
                      </p>
                    )}
                    {!["completed", "failed"].includes(item.status) && (
                      <Progress className="mt-2 h-1" value={value} />
                    )}
                  </div>
                  {item.status === "completed" ? (
                    <Button
                      aria-label={`Abrir ${item.originalName}`}
                      onClick={() => {
                        if (item.resultDocumentId)
                          void navigate(
                            `/documents/${item.projectId}/document/${item.resultDocumentId}`,
                          );
                      }}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <CheckCircle2Icon className="size-5 text-emerald-600" />
                    </Button>
                  ) : item.status === "failed" ? (
                    <Button
                      onClick={() =>
                        void retryDocumentImport(item.id)
                          .then(() => client.invalidateQueries({ queryKey: documentImportListKey }))
                          .catch(() => toast.error("Não foi possível repetir esta importação."))
                      }
                      size="sm"
                      variant="outline"
                    >
                      Tentar de novo
                    </Button>
                  ) : !["failed", "canceled"].includes(item.status) ? (
                    <Button
                      aria-label={`Cancelar ${item.originalName}`}
                      onClick={() => {
                        abortDocumentImportUpload(item.id);
                        void cancelDocumentImport(item.id)
                          .then(() => client.invalidateQueries({ queryKey: documentImportListKey }))
                          .catch(() => toast.error("Não foi possível cancelar esta importação."));
                      }}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <XIcon />
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
          {storage && (
            <p className="shrink-0 border-t px-4 py-2.5 text-xs text-muted-foreground">
              {Math.round(storage.usedBytes / 1024 / 1024)} MB de{" "}
              {Math.round(storage.limitBytes / 1024 / 1024)} MB usados
            </p>
          )}
        </>
      )}
    </section>
  );
};
