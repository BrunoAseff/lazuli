import { DOCUMENT_IMPORT_MAX_ACTIVE } from "@lazuli/shared";
import { UploadCloudIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { DocumentDomainIcon } from "@/components/domain-icons.ts";
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { FileDropzone } from "@/components/file-dropzone.tsx";
import { acceptedDocumentImportTypes, inferImportMimeType } from "./document-import-api.ts";

export type PreparedImportFile = { file: File; originalName: string };
type PendingFile = PreparedImportFile & { id: string; extension: string; title: string };

export const splitImportFileName = (name: string) => {
  const match = /^(.*?)(\.(?:markdown|docx|pdf|txt|md))$/i.exec(name);
  return { title: match?.[1] || name, extension: match?.[2] || "" };
};
const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export const DocumentImportDialog = ({
  onOpenChange,
  onSubmit,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  onSubmit: (files: PreparedImportFile[]) => Promise<boolean>;
  open: boolean;
}) => {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const addFiles = (incoming: File[]) => {
    const available = DOCUMENT_IMPORT_MAX_ACTIVE - files.length;
    if (available <= 0) {
      toast.warning(`Envie no máximo ${DOCUMENT_IMPORT_MAX_ACTIVE} arquivos por vez.`);
      return;
    }
    const accepted: PendingFile[] = [];
    for (const file of incoming.slice(0, available)) {
      if (!inferImportMimeType(file)) {
        toast.error(`${file.name}: formato não suportado.`);
        continue;
      }
      const { title, extension } = splitImportFileName(file.name);
      accepted.push({ id: crypto.randomUUID(), file, originalName: file.name, extension, title });
    }
    if (incoming.length > available)
      toast.warning(`Envie no máximo ${DOCUMENT_IMPORT_MAX_ACTIVE} arquivos por vez.`);
    setFiles((current) => [...current, ...accepted]);
  };
  const close = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFiles([]);
    }
    onOpenChange(nextOpen);
  };
  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (submitting && !nextOpen) return;
        close(nextOpen);
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Importar documentos</DialogTitle>
          <DialogDescription>
            Revise os arquivos antes de enviá-los. São aceitos PDF textual, DOCX, Markdown e texto.
          </DialogDescription>
        </DialogHeader>
        <FileDropzone
          accept={acceptedDocumentImportTypes}
          multiple
          disabled={submitting}
          onFiles={addFiles}
        />
        {files.length > 0 && (
          <div className="lazuli-thin-scrollbar max-h-60 space-y-2 overflow-y-auto pr-1">
            {files.map((item) => (
              <div
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 sm:flex sm:gap-3"
                key={item.id}
              >
                <DocumentDomainIcon
                  className="size-[1.125rem] shrink-0 text-muted-foreground"
                  weight="duotone"
                />
                <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-lg border bg-background transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
                  <Input
                    aria-label={`Nome de ${item.originalName}`}
                    className="h-9 min-w-0 rounded-none border-0 bg-transparent pr-1 shadow-none focus-visible:border-0 focus-visible:ring-0"
                    maxLength={Math.max(1, 255 - item.extension.length)}
                    onChange={(event) =>
                      setFiles((current) =>
                        current.map((file) =>
                          file.id === item.id ? { ...file, title: event.target.value } : file,
                        ),
                      )
                    }
                    value={item.title}
                  />
                  <span className="flex h-9 shrink-0 items-center border-l bg-muted/45 px-2 text-sm text-muted-foreground">
                    {item.extension}
                  </span>
                </div>
                <span className="col-start-2 shrink-0 text-xs text-muted-foreground sm:col-auto">
                  {formatBytes(item.file.size)}
                </span>
                <Button
                  aria-label={`Remover ${item.originalName}`}
                  onClick={() =>
                    setFiles((current) => current.filter((file) => file.id !== item.id))
                  }
                  size="icon-sm"
                  variant="ghost"
                >
                  <XIcon />
                </Button>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <DialogCancelButton disabled={submitting} onClick={() => close(false)}>
            Cancelar
          </DialogCancelButton>
          <Button
            disabled={submitting || !files.length || files.some((item) => !item.title.trim())}
            onClick={async () => {
              setSubmitting(true);
              try {
                const accepted = await onSubmit(
                  files.map((item) => ({
                    file: item.file,
                    originalName: `${item.title.trim()}${item.extension}`,
                  })),
                );
                if (accepted) close(false);
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <UploadCloudIcon />
            {submitting
              ? "Enviando…"
              : files.length
                ? `Importar ${files.length} ${files.length === 1 ? "arquivo" : "arquivos"}`
                : "Importar arquivos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
