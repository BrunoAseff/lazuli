import { DOCUMENT_IMPORT_MAX_ACTIVE } from "@lazuli/shared";
import { UploadCloudIcon, XIcon } from "@/components/icons.tsx";
import { useState } from "react";
import { toast } from "sonner";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
import { spring } from "@/lib/motion.ts";

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
  const reduced = useReducedMotion();
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="px-6 py-5">
          <DialogTitle>Importar documentos</DialogTitle>
          <DialogDescription>
            Escolha os arquivos e ajuste os nomes antes de importar, se precisar.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5 lazuli-thin-scrollbar">
          <FileDropzone
            accept={acceptedDocumentImportTypes}
            multiple
            disabled={submitting}
            onFiles={addFiles}
            description="Transforme seus arquivos em documentos editáveis, prontos para conectar ao estudo."
            hint={`PDF textual, DOCX, Markdown e TXT · até ${DOCUMENT_IMPORT_MAX_ACTIVE} arquivos por vez`}
          />
          {files.length > 0 && (
            <section aria-label="Arquivos para importar" className="space-y-1">
              <h3 className="mb-3 text-sm font-medium">
                Revisar {files.length} {files.length === 1 ? "arquivo" : "arquivos"}
              </h3>
              <AnimatePresence initial={false}>
                {files.map((item) => (
                  <motion.div
                    animate={{ opacity: 1, height: "auto" }}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 overflow-hidden border-b border-border/40 py-3 last:border-b-0 sm:flex sm:gap-3"
                    exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
                    initial={reduced ? false : { opacity: 0, height: 0 }}
                    key={item.id}
                    transition={reduced ? { duration: 0 } : spring.smooth}
                  >
                    <DocumentDomainIcon className="size-[1.125rem] shrink-0 text-muted-foreground" />
                    {/* Same anatomy as every field (border, surface, hover, focus); the extension is a quiet suffix. */}
                    <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-[var(--radius)] border border-input bg-card transition-[border-color,box-shadow] hover:border-[color-mix(in_oklab,var(--foreground)_32%,transparent)] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
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
                      <span className="flex h-9 shrink-0 items-center pr-3 text-sm text-muted-foreground">
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
                  </motion.div>
                ))}
              </AnimatePresence>
            </section>
          )}
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-none px-6 py-4">
          <DialogCancelButton disabled={submitting} onClick={() => close(false)}>
            Cancelar
          </DialogCancelButton>
          <Button
            disabled={!files.length || files.some((item) => !item.title.trim())}
            pending={submitting}
            pendingLabel="Enviando"
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
            {files.length
              ? `Importar ${files.length} ${files.length === 1 ? "arquivo" : "arquivos"}`
              : "Importar arquivos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
