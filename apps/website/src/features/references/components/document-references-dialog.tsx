import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import { REFERENCE_PAGE_SIZE } from "@lazuli/shared";
import { Layers3Icon, Link2Icon, PlusIcon, SquareCheckBigIcon } from "@/components/icons.tsx";
import { Link } from "react-router";
import { useEffect, useState, type Ref } from "react";

import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { PaginationControls } from "@/components/pagination-controls.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { useReferences } from "../api/reference-queries.ts";
import { setSourceAnchorsShown, useSourceAnchorsShown } from "../source-anchor-visibility.ts";
import { ReferenceDeleteButton } from "./reference-delete-button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { ReferenceRowsSkeleton } from "./reference-document-row.tsx";

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
  showAnchorsOption = false,
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
  /** The whole document's list also holds the choice of marking the linked passages in its text. */
  showAnchorsOption?: boolean;
}) => {
  const [page, setPage] = useState(1);
  const anchorsShown = useSourceAnchorsShown();
  useEffect(() => setPage(1), [anchorId, documentId, open]);
  const references = useReferences(
    { anchorId, documentId, page, pageSize: REFERENCE_PAGE_SIZE },
    open,
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="px-6 py-5">
          <div className="pr-8">
            <div>
              <DialogTitle>
                {anchorId ? "Este trecho no seu estudo" : "Materiais conectados"}
              </DialogTitle>
              <DialogDescription>
                {anchorId
                  ? "Flashcards e questões que usam esta fonte."
                  : "O que você já criou a partir desta fonte."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[min(60vh,32rem)] overflow-y-auto px-3 py-4 lazuli-thin-scrollbar">
          {references.isPending && <ReferenceRowsSkeleton />}
          {references.isError && (
            <div className="px-3 py-4">
              <p className="text-sm text-destructive">
                Não foi possível carregar os materiais conectados.
              </p>
              <Button variant="outline" className="mt-3" onClick={() => void references.refetch()}>
                Tentar novamente
              </Button>
            </div>
          )}
          {references.data?.items.length === 0 && (
            <p className="px-3 py-4 text-sm text-muted-foreground">Nenhum material conectado.</p>
          )}
          {anchorId && references.data?.items[0]?.sourcePreview && (
            <blockquote className="source-excerpt mx-3 mb-5 font-reading text-base leading-relaxed">
              {references.data.items[0].sourcePreview}
            </blockquote>
          )}
          <div className="grid gap-1">
            {references.data?.items.map((reference) => {
              const isFlashcard = reference.material.type === "flashcard";
              const Icon = isFlashcard ? Layers3Icon : SquareCheckBigIcon;
              const href = isFlashcard
                ? `/flashcards/${reference.material.collectionId}?card=${reference.material.id}`
                : `/quizzes/${reference.material.collectionId}?question=${reference.material.id}`;
              return (
                <div
                  className="group relative flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring/50"
                  key={reference.id}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <OverflowTooltip
                      text={reference.material.preview || reference.material.collectionTitle}
                    >
                      {(ref) => (
                        <Link
                          className="block truncate text-sm font-medium underline-offset-4 outline-none group-hover:underline after:absolute after:inset-0 after:rounded-lg"
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
                  <div className="relative z-10">
                    <ReferenceDeleteButton
                      onRemoved={
                        anchorId && references.data.pagination.totalItems === 1
                          ? () => onLastReferenceRemoved?.(anchorId)
                          : undefined
                      }
                      referenceId={reference.id}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {references.data && (
            <PaginationControls
              label="Paginação dos materiais conectados"
              onPageChange={setPage}
              pagination={references.data.pagination}
            />
          )}
        </div>
        {(onAdd ||
          showAnchorsOption ||
          onCreateFlashcard ||
          onCreateQuiz ||
          (onAdjust && Boolean(references.data?.items.length))) && (
          <div className="flex flex-wrap justify-end gap-2 px-6 py-4">
            {showAnchorsOption && (
              <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm sm:mr-auto">
                <Switch checked={anchorsShown} onCheckedChange={setSourceAnchorsShown} />
                Sublinhar trechos conectados
              </label>
            )}
            {onAdjust && Boolean(references.data?.items.length) && (
              <Button className="sm:mr-auto" onClick={onAdjust} variant="ghost">
                Ajustar trecho
              </Button>
            )}
            {onAdd && (
              <Button onClick={onAdd} variant="outline">
                <Link2Icon aria-hidden="true" /> Conectar flashcard ou questão
              </Button>
            )}
            {(onCreateFlashcard || onCreateQuiz) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <PlusIcon aria-hidden="true" /> Criar flashcard ou questão
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onCreateFlashcard && (
                    <DropdownMenuItem onSelect={onCreateFlashcard}>
                      <Layers3Icon /> Flashcard
                    </DropdownMenuItem>
                  )}
                  {onCreateQuiz && (
                    <DropdownMenuItem onSelect={onCreateQuiz}>
                      <SquareCheckBigIcon /> Questão
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

/** The document's link to study: how many materials use it, at a glance in the header. */
export const DocumentReferencesButton = ({
  documentId,
  onClick,
}: {
  documentId: string;
  onClick: () => void;
}) => {
  const references = useReferences({ documentId, page: 1, pageSize: 1 });
  const count = references.data?.pagination.totalItems;
  const name =
    count === undefined
      ? "Materiais conectados"
      : count === 0
        ? "Nenhum material conectado"
        : count === 1
          ? "1 material conectado"
          : `${count} materiais conectados`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-label={name} onClick={onClick} size="sm" variant="ghost">
          <Link2Icon aria-hidden="true" />
          {/* Where the toolbar is narrow the label yields, so the toolbar never wraps into two rows. */}
          <span className="hidden @xl/toolbar:inline">Materiais conectados</span>
          {Boolean(count) && <span className="text-muted-foreground tabular-nums">{count}</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
};
