import { FLASHCARD_IMPORT_TEXT_MAX_LENGTH, type FlashcardImportPreview } from "@lazuli/shared";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FileSpreadsheetIcon,
  LoaderCircleIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { cn } from "@/lib/utils.ts";
import { useImportFlashcards, usePreviewFlashcardImport } from "../api/flashcard-queries.ts";
import { getFlashcardCollectionErrorMessage } from "../flashcard-messages.ts";

const PREVIEW_PAGE_SIZE = 25;

export const FlashcardImportDialog = ({
  collectionId,
  onOpenChange,
  open,
}: {
  collectionId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<FlashcardImportPreview | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const previewImport = usePreviewFlashcardImport(collectionId);
  const importCards = useImportFlashcards(collectionId);

  const choose = async (next: File) => {
    setFile(next);
    setPreview(null);
    setPreviewPage(1);
    try {
      setPreview(await previewImport.mutateAsync(next));
    } catch (error) {
      setFile(null);
      toast.error(
        getFlashcardCollectionErrorMessage(error, "Não foi possível interpretar este arquivo."),
      );
    }
  };

  const close = () => {
    if (previewImport.isPending || importCards.isPending) return;
    resetAndClose();
  };

  const resetAndClose = () => {
    setFile(null);
    setPreview(null);
    setPreviewPage(1);
    onOpenChange(false);
  };

  const submit = async () => {
    if (!preview || preview.rows.some(({ answer, question }) => !answer.trim() || !question.trim()))
      return;
    try {
      const result = await importCards.mutateAsync({
        cards: preview.rows.map((row) => ({ ...row, id: crypto.randomUUID() })),
      });
      toast.success(
        `${result.imported} ${result.imported === 1 ? "flashcard importado" : "flashcards importados"}.`,
      );
      resetAndClose();
    } catch (error) {
      toast.error(getFlashcardCollectionErrorMessage(error, "Não foi possível importar os cards."));
    }
  };

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const next = event.dataTransfer.files[0];
    if (next) void choose(next);
  };

  const updateRow = (index: number, field: "answer" | "question", value: string) =>
    setPreview((current) =>
      current
        ? {
            ...current,
            rows: current.rows.map((row, rowIndex) =>
              rowIndex === index ? { ...row, [field]: value } : row,
            ),
          }
        : current,
    );

  const invalidRows =
    preview?.rows.reduce(
      (total, { answer, question }) => total + Number(!answer.trim() || !question.trim()),
      0,
    ) ?? 0;
  const previewPages = preview ? Math.ceil(preview.rows.length / PREVIEW_PAGE_SIZE) : 0;
  const visibleRows =
    preview?.rows.slice((previewPage - 1) * PREVIEW_PAGE_SIZE, previewPage * PREVIEW_PAGE_SIZE) ??
    [];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-xl">Importar flashcards</DialogTitle>
          <DialogDescription>
            Revise os pares reconhecidos antes de adicioná-los à coleção.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-6 subtle-scrollbar">
          {!preview ? (
            <button
              className={cn(
                "grid min-h-52 w-full place-items-center border border-dashed p-6 text-center transition-colors hover:bg-muted/35",
                dragging && "border-foreground bg-muted/35",
              )}
              disabled={previewImport.isPending}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={drop}
              type="button"
            >
              <span>
                {previewImport.isPending ? (
                  <LoaderCircleIcon className="mx-auto mb-3 size-7 animate-spin" />
                ) : (
                  <UploadIcon className="mx-auto mb-3 size-7 text-muted-foreground" />
                )}
                <strong className="block font-medium">
                  {previewImport.isPending ? "Lendo arquivo…" : "Arraste um arquivo ou clique aqui"}
                </strong>
                <span className="mt-2 block text-sm text-muted-foreground">
                  CSV e TSV: duas colunas, pergunta e resposta. TXT: pares separados por tabulação
                  ou blocos separados por uma linha vazia.
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  UTF-8 · até 2 MB · máximo de 1.000 cards
                </span>
              </span>
            </button>
          ) : (
            <div>
              <div className="mb-5 flex items-center gap-3 border p-3">
                <FileSpreadsheetIcon className="size-5 shrink-0 text-muted-foreground" />
                <OverflowTooltip text={file?.name ?? "Arquivo"}>
                  {(ref) => (
                    <span className="min-w-0 flex-1 truncate" ref={ref}>
                      {file?.name}
                    </span>
                  )}
                </OverflowTooltip>
                <Button
                  aria-label="Escolher outro arquivo"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                    setPreviewPage(1);
                  }}
                  size="icon-sm"
                  variant="ghost"
                >
                  <XIcon />
                </Button>
              </div>
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="text-sm font-medium">
                  {preview.rows.length}{" "}
                  {preview.rows.length === 1 ? "flashcard encontrado" : "flashcards encontrados"}
                </p>
                {preview.skippedRows > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {preview.skippedRows} linhas incompletas ignoradas
                  </p>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto border subtle-scrollbar">
                <div className="sticky top-0 grid grid-cols-2 border-b bg-muted px-3 py-2 text-xs font-medium tracking-wide uppercase">
                  <span>Pergunta</span>
                  <span>Resposta</span>
                </div>
                {visibleRows.map((row, index) => {
                  const rowIndex = (previewPage - 1) * PREVIEW_PAGE_SIZE + index;
                  return (
                    <div
                      className="grid grid-cols-1 gap-3 border-b px-3 py-3 text-sm last:border-b-0 sm:grid-cols-2"
                      key={rowIndex}
                    >
                      <Textarea
                        aria-label={`Pergunta do flashcard ${rowIndex + 1}`}
                        aria-invalid={!row.question.trim()}
                        className="min-h-20 resize-y"
                        maxLength={FLASHCARD_IMPORT_TEXT_MAX_LENGTH}
                        onChange={(event) => updateRow(rowIndex, "question", event.target.value)}
                        value={row.question}
                      />
                      <Textarea
                        aria-label={`Resposta do flashcard ${rowIndex + 1}`}
                        aria-invalid={!row.answer.trim()}
                        className="min-h-20 resize-y"
                        maxLength={FLASHCARD_IMPORT_TEXT_MAX_LENGTH}
                        onChange={(event) => updateRow(rowIndex, "answer", event.target.value)}
                        value={row.answer}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex min-h-8 items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground">
                  {invalidRows > 0
                    ? `${invalidRows} ${invalidRows === 1 ? "card precisa" : "cards precisam"} de pergunta e resposta.`
                    : null}
                </p>
                {previewPages > 1 && (
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <Button
                      aria-label="Página anterior"
                      disabled={previewPage === 1}
                      onClick={() => setPreviewPage((current) => current - 1)}
                      size="icon-sm"
                      variant="outline"
                    >
                      <ChevronLeftIcon />
                    </Button>
                    <span>
                      {previewPage} de {previewPages}
                    </span>
                    <Button
                      aria-label="Próxima página"
                      disabled={previewPage === previewPages}
                      onClick={() => setPreviewPage((current) => current + 1)}
                      size="icon-sm"
                      variant="outline"
                    >
                      <ChevronRightIcon />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
          <input
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
            className="sr-only"
            onChange={(event) => {
              const next = event.target.files?.[0];
              if (next) void choose(next);
              event.target.value = "";
            }}
            ref={inputRef}
            type="file"
          />
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-none border-t px-6 py-4">
          <DialogCancelButton
            disabled={previewImport.isPending || importCards.isPending}
            onClick={close}
          >
            Cancelar
          </DialogCancelButton>
          <Button
            disabled={!preview || invalidRows > 0 || importCards.isPending}
            onClick={() => void submit()}
          >
            {importCards.isPending && <LoaderCircleIcon className="animate-spin" />}
            {preview
              ? `Importar ${preview.rows.length} ${preview.rows.length === 1 ? "flashcard" : "flashcards"}`
              : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
