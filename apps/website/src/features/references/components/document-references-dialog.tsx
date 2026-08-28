import { REFERENCE_PAGE_SIZE } from "@lazuli/shared";
import {
  Layers3Icon,
  Link2Icon,
  LoaderCircleIcon,
  PlusIcon,
  SquareCheckBigIcon,
} from "lucide-react";
import { Link } from "react-router";
import { useEffect, useState, type Ref } from "react";

import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { PaginationControls } from "@/components/pagination-controls.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { useReferences } from "../api/reference-queries.ts";
import { ReferenceDeleteButton } from "./reference-delete-button.tsx";

export const DocumentReferencesDialog = ({
  anchorId,
  documentId,
  onAdd,
  onAdjust,
  onCreateFlashcard,
  onCreateQuiz,
  onOpenChange,
  onLastReferenceRemoved,
  open,
}: {
  anchorId?: string;
  documentId: string;
  onAdd?: () => void;
  onAdjust?: () => void;
  onCreateFlashcard?: () => void;
  onCreateQuiz?: () => void;
  onOpenChange: (open: boolean) => void;
  onLastReferenceRemoved?: (anchorId: string) => void | Promise<void>;
  open: boolean;
}) => {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [anchorId, documentId, open]);
  const references = useReferences(
    { anchorId, documentId, page, pageSize: REFERENCE_PAGE_SIZE },
    open,
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b px-6 py-5">
          <div className="pr-8">
            <div>
              <DialogTitle className="text-xl">
                {anchorId ? "Materiais deste trecho" : "Referências do documento"}
              </DialogTitle>
              <DialogDescription>
                {anchorId
                  ? "Flashcards e questões conectados à seleção."
                  : "Todos os materiais conectados a este documento."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[min(60vh,32rem)] overflow-y-auto px-6 py-4 lazuli-thin-scrollbar">
          {references.isPending && (
            <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <LoaderCircleIcon aria-hidden="true" className="animate-spin" /> Carregando...
            </p>
          )}
          {references.isError && (
            <p className="py-4 text-sm text-destructive">
              Não foi possível carregar as referências.
            </p>
          )}
          {references.data?.items.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">Nenhum material conectado.</p>
          )}
          <div className="divide-y">
            {references.data?.items.map((reference) => {
              const isFlashcard = reference.material.type === "flashcard";
              const Icon = isFlashcard ? Layers3Icon : SquareCheckBigIcon;
              const href = isFlashcard
                ? `/flashcards/${reference.material.collectionId}?card=${reference.material.id}`
                : `/quizzes/${reference.material.collectionId}?question=${reference.material.id}`;
              return (
                <div className="flex min-w-0 items-center gap-3 py-3" key={reference.id}>
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <OverflowTooltip
                      text={reference.material.preview || reference.material.collectionTitle}
                    >
                      {(ref) => (
                        <Link
                          className="block truncate text-sm font-medium underline underline-offset-4"
                          ref={ref as Ref<HTMLAnchorElement>}
                          to={href}
                        >
                          {reference.material.preview || "Material sem texto"}
                        </Link>
                      )}
                    </OverflowTooltip>
                    <p className="truncate text-xs text-muted-foreground">
                      {isFlashcard ? "Flashcard" : "Questão"} · {reference.material.collectionTitle}
                      {!anchorId && ` · ${reference.anchorId ? "Trecho" : "Documento inteiro"}`}
                    </p>
                  </div>
                  <ReferenceDeleteButton
                    onRemoved={
                      anchorId && references.data.pagination.totalItems === 1
                        ? () => onLastReferenceRemoved?.(anchorId)
                        : undefined
                    }
                    referenceId={reference.id}
                  />
                </div>
              );
            })}
          </div>
          {references.data && (
            <PaginationControls
              label="Paginação das referências"
              onPageChange={setPage}
              pagination={references.data.pagination}
            />
          )}
        </div>
        {(onAdd ||
          onCreateFlashcard ||
          onCreateQuiz ||
          (onAdjust && Boolean(references.data?.items.length))) && (
          <div className="flex flex-wrap justify-end gap-2 border-t px-6 py-4">
            {onCreateFlashcard && (
              <Button onClick={onCreateFlashcard} variant="outline">
                <Layers3Icon aria-hidden="true" className="size-4 text-primary" /> Criar flashcard
              </Button>
            )}
            {onCreateQuiz && (
              <Button onClick={onCreateQuiz} variant="outline">
                <SquareCheckBigIcon aria-hidden="true" className="size-4 text-primary" /> Criar
                questão
              </Button>
            )}
            {onAdjust && Boolean(references.data?.items.length) && (
              <Button onClick={onAdjust} variant="outline">
                Ajustar trecho
              </Button>
            )}
            {onAdd && (
              <Button onClick={onAdd}>
                <PlusIcon aria-hidden="true" /> Vincular material
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const DocumentReferencesButton = ({ onClick }: { onClick: () => void }) => (
  <Button
    aria-label="Ver referências do documento"
    onClick={onClick}
    size="icon-sm"
    variant="ghost"
  >
    <Link2Icon aria-hidden="true" />
  </Button>
);
