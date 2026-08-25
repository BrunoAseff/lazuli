import { DOCUMENT_IMPORT_MAX_ACTIVE } from "@lazuli/shared";
import { FileTextIcon, PlusIcon, UploadCloudIcon, XIcon } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
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
import { cn } from "@/lib/utils.ts";
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
  onSubmit: (files: PreparedImportFile[]) => void;
  open: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);
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
      setDragging(false);
    }
    onOpenChange(nextOpen);
  };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  };
  return (
    <Dialog onOpenChange={close} open={open}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Importar documentos</DialogTitle>
          <DialogDescription>
            Revise os arquivos antes de enviá-los. São aceitos PDF textual, DOCX, Markdown e texto.
          </DialogDescription>
        </DialogHeader>
        <input
          accept={acceptedDocumentImportTypes}
          className="sr-only"
          multiple
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.currentTarget.value = "";
          }}
          ref={inputRef}
          type="file"
        />
        <div
          className={cn(
            "grid min-h-36 place-items-center rounded-lg border border-dashed p-5 text-center transition-colors",
            dragging && "border-foreground bg-muted/50",
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={drop}
        >
          <div>
            <UploadCloudIcon className="mx-auto mb-3 size-7 text-muted-foreground" />
            <p className="font-medium">Arraste os arquivos para cá</p>
            <p className="mt-1 text-xs text-muted-foreground">ou escolha no seu dispositivo</p>
            <Button className="mt-4" onClick={() => inputRef.current?.click()} variant="outline">
              <PlusIcon /> Escolher arquivos
            </Button>
          </div>
        </div>
        {files.length > 0 && (
          <div className="lazuli-thin-scrollbar max-h-60 space-y-2 overflow-y-auto pr-1">
            {files.map((item) => (
              <div className="flex items-center gap-3 rounded-md border px-3 py-2" key={item.id}>
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 items-center">
                  <Input
                    aria-label={`Nome de ${item.originalName}`}
                    className="h-8 min-w-0 border-r-0 pr-0"
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
                  <span className="flex h-8 items-center border border-l-0 bg-muted/40 pr-2 text-sm text-muted-foreground">
                    {item.extension}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
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
          <DialogCancelButton onClick={() => close(false)}>Cancelar</DialogCancelButton>
          <Button
            disabled={!files.length || files.some((item) => !item.title.trim())}
            onClick={() => {
              onSubmit(
                files.map((item) => ({
                  file: item.file,
                  originalName: `${item.title.trim()}${item.extension}`,
                })),
              );
              close(false);
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
