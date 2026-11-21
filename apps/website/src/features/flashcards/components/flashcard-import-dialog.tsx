import { FLASHCARD_IMPORT_TEXT_MAX_LENGTH, type FlashcardImportPreview } from "@lazuli/shared";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FileSpreadsheetIcon,
  XIcon,
} from "@/components/icons.tsx";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { FileDropzone } from "@/components/file-dropzone.tsx";
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
      toast.error(
        getFlashcardCollectionErrorMessage(error, "Não foi possível importar os flashcards."),
      );
    }
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

  // A pair the file recognized wrongly can be left out instead of being edited into shape.
  const removeRow = (index: number) =>
    setPreview((current) => {
      if (!current) return current;
      const rows = current.rows.filter((_, rowIndex) => rowIndex !== index);
      setPreviewPage((page) =>
        Math.min(page, Math.max(1, Math.ceil(rows.length / PREVIEW_PAGE_SIZE))),
      );
      return { ...current, rows };
    });

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
        <DialogHeader className="px-6 py-5">
          <DialogTitle>Importar flashcards</DialogTitle>
          <DialogDescription>
            Revise os pares reconhecidos antes de adicioná-los à coleção.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-6 lazuli-thin-scrollbar">
          {!preview ? (
            <FileDropzone
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
              disabled={previewImport.isPending}
              busy={previewImport.isPending}
              buttonLabel="Escolher arquivo"
              onFiles={(files) => {
                if (files[0]) void choose(files[0]);
              }}
              description="CSV e TSV: duas colunas, pergunta e resposta. TXT: pares separados por tabulação ou blocos separados por uma linha vazia."
              hint="UTF-8 · até 2 MB · máximo de 1.000 flashcards"
            />
          ) : (
            <div>
              <div className="mb-5 flex items-center gap-3 rounded-lg border p-3">
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
                    {preview.skippedRows === 1
                      ? "1 linha incompleta ignorada"
                      : `${preview.skippedRows} linhas incompletas ignoradas`}
                  </p>
                )}
              </div>
              {preview.rows.length === 0 ? (
                <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum flashcard para importar. Escolha outro arquivo ou cancele.
                </p>
              ) : (
                <div className="max-h-80 overflow-y-auto rounded-lg border lazuli-thin-scrollbar">
                  <div className="sticky top-0 z-10 hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] gap-3 border-b border-border/50 bg-card px-3 py-3 text-xs font-medium text-muted-foreground sm:grid">
                    <span>Pergunta</span>
                    <span>Resposta</span>
                    <span className="sr-only">Remover</span>
                  </div>
                  {visibleRows.map((row, index) => {
                    const rowIndex = (previewPage - 1) * PREVIEW_PAGE_SIZE + index;
                    return (
                      <div
                        className="grid grid-cols-[minmax(0,1fr)_2rem] gap-3 border-b px-3 py-3 text-sm last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem]"
                        key={rowIndex}
                      >
                        <Textarea
                          aria-label={`Pergunta do flashcard ${rowIndex + 1}`}
                          aria-invalid={!row.question.trim()}
                          className="min-h-20"
                          maxLength={FLASHCARD_IMPORT_TEXT_MAX_LENGTH}
                          onChange={(event) => updateRow(rowIndex, "question", event.target.value)}
                          value={row.question}
                        />
                        <Textarea
                          aria-label={`Resposta do flashcard ${rowIndex + 1}`}
                          aria-invalid={!row.answer.trim()}
                          className="col-start-1 min-h-20 sm:col-start-2"
                          maxLength={FLASHCARD_IMPORT_TEXT_MAX_LENGTH}
                          onChange={(event) => updateRow(rowIndex, "answer", event.target.value)}
                          value={row.answer}
                        />
                        <Button
                          aria-label={`Remover o flashcard ${rowIndex + 1} da importação`}
                          className="col-start-2 row-start-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:col-start-3"
                          onClick={() => removeRow(rowIndex)}
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          <XIcon />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-3 flex min-h-8 items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground">
                  {invalidRows > 0
                    ? `${invalidRows} ${invalidRows === 1 ? "flashcard precisa" : "flashcards precisam"} de pergunta e resposta.`
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
        </div>
        <DialogFooter className="mx-0 mb-0 px-6 py-4">
          <DialogCancelButton
            disabled={previewImport.isPending || importCards.isPending}
            onClick={close}
          >
            Cancelar
          </DialogCancelButton>
          <Button
            pending={importCards.isPending}
            disabled={!preview?.rows.length || invalidRows > 0 || importCards.isPending}
            onClick={() => void submit()}
          >
            {preview
              ? preview.rows.length
                ? `Importar ${preview.rows.length} ${preview.rows.length === 1 ? "flashcard" : "flashcards"}`
                : "Importar"
              : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
