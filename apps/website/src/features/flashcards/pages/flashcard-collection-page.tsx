import { isNotFound, ResourceUnavailable } from "@/components/not-found-page.tsx";
import {
  FLASHCARD_PAGE_SIZE,
  flashcardListQuerySchema,
  type FlashcardDetail,
  type FlashcardSummary,
} from "@lazuli/shared";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  CalendarClockIcon,
  CalendarPlusIcon,
  FilterIcon,
  HistoryIcon,
  Layers3Icon,
  ListFilterIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "@/components/icons.tsx";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { FilterSelect } from "@/components/filter-select.tsx";
import { FilterCount } from "@/components/filter-count.tsx";
import { ConfirmationDialog } from "@/components/confirmation-dialog.tsx";
import { PaginationControls } from "@/components/pagination-controls.tsx";
import { SearchInput } from "@/components/search-input.tsx";
import { StudyItemSummaryBar } from "@/components/study-item-summary-bar.tsx";
import { StudyWorkspaceSkeleton } from "@/components/study-workspace-skeleton.tsx";
import { StudyItemListState } from "@/components/study-item-list-state.tsx";
import {
  StudyIndexHeader,
  StudyIndexScroll,
  StudyIndexSkeleton,
  StudyIndexTools,
} from "@/components/study-index.tsx";
import { resultCount } from "@/lib/text.ts";
import { AiCollectionGenerationAction } from "@/features/ai/components/ai-collection-generation-dialog.tsx";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { StudyCollectionStart } from "@/components/study-collection-start.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { useDebouncedSearch } from "@/hooks/use-debounced-search.ts";
import { cn } from "@/lib/utils.ts";
import { parsePositivePage } from "@/lib/pagination.ts";
import { mergeSearchParams } from "@/lib/search-params.ts";
import type { StudyItemAction, StudyItemBatchAction } from "@/lib/study-actions.ts";
import {
  findReplacementStudyItemId,
  type PendingStudyEditorState,
  type StudyEditorState,
} from "@/lib/study-editor.ts";
import {
  useBatchFlashcards,
  useDeleteFlashcard,
  useFlashcard,
  useFlashcardCollection,
  useRefreshWhenDue,
  useFlashcards,
} from "../api/flashcard-queries.ts";
import { CollectionPicker, FlashcardEditorPanel } from "../components/flashcard-editor-sheet.tsx";
import {
  DueMemoryMark,
  FlashcardIndex,
  NewMemoryMark,
  ScheduledMemoryMark,
} from "../components/flashcard-items.tsx";
import { FlashcardImportDialog } from "../components/flashcard-import-dialog.tsx";
import { FlashcardPracticeButton } from "../components/flashcard-practice-button.tsx";
import { PracticeSetupDialog } from "../components/practice-setup-dialog.tsx";
import { getFlashcardCollectionErrorMessage } from "../flashcard-messages.ts";

const flashcardListDefaults = { filter: "all", sort: "updated", status: "active" };

export const FlashcardCollectionPage = () => {
  const { collectionId = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.get("query")?.slice(0, 200).trim() ?? "";
  const linkedCardId = params.get("card");
  const rawFilter = params.get("filter");
  const rawSort = params.get("sort");
  const input = flashcardListQuerySchema.parse({
    query,
    filter: ["new", "due", "scheduled"].includes(rawFilter ?? "") ? rawFilter : "all",
    sort: ["created", "due"].includes(rawSort ?? "") ? rawSort : "updated",
    status: params.get("status") === "archived" ? "archived" : "active",
    page: parsePositivePage(params.get("page")),
    pageSize: FLASHCARD_PAGE_SIZE,
  });
  const updateParams = (
    changes: Record<string, string | undefined>,
    resetPage = true,
    replace = false,
  ) =>
    setParams(
      (current) =>
        mergeSearchParams(current, changes, {
          defaults: flashcardListDefaults,
          resetPage,
        }),
      { replace },
    );
  const [search, setSearch] = useDebouncedSearch(query, (value) =>
    updateParams({ query: value || undefined }),
  );
  const [selected, setSelected] = useState(new Set<string>());
  const [editor, setEditor] = useState<StudyEditorState>(null);
  const [duplicateSource, setDuplicateSource] = useState<FlashcardDetail | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [pendingEditor, setPendingEditor] = useState<PendingStudyEditorState>(null);
  const compact = useIsMobile();
  const [pendingDelete, setPendingDelete] = useState<FlashcardSummary | null>(null);
  const [pendingArchive, setPendingArchive] = useState<FlashcardSummary | null>(null);
  const [batchArchiveOpen, setBatchArchiveOpen] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveCard, setMoveCard] = useState<FlashcardSummary | null>(null);
  const [moveTarget, setMoveTarget] = useState(collectionId);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const collection = useFlashcardCollection(collectionId);
  useRefreshWhenDue(collectionId, collection.data?.nextPracticeAt);
  const cards = useFlashcards(collectionId, input);
  const detail = useFlashcard(collectionId, editor?.type === "edit" ? editor.id : null);
  const batch = useBatchFlashcards(collectionId);
  const remove = useDeleteFlashcard(collectionId);

  useEffect(() => {
    if (linkedCardId)
      setEditor(linkedCardId === "new" ? { type: "create" } : { type: "edit", id: linkedCardId });
  }, [linkedCardId]);
  useEffect(() => setSelected(new Set()), [input.page, input.filter, input.query, input.status]);
  useEffect(() => {
    const totalPages = cards.data?.pagination.totalPages;
    if (totalPages !== undefined && input.page > Math.max(totalPages, 1))
      updateParams({ page: totalPages > 1 ? String(totalPages) : undefined }, false, true);
  }, [cards.data?.pagination.totalPages, input.page]);
  useEffect(() => {
    if (compact || editor || linkedCardId || !cards.data?.items.length) return;
    const first = cards.data.items[0];
    if (!first) return;
    setEditor({ type: "edit", id: first.id });
    updateParams({ card: first.id }, false, true);
  }, [cards.data?.items, compact, editor, linkedCardId]);

  const openCard = (card: FlashcardSummary) => {
    if (activeId === card.id) return;
    const next = { type: "edit" as const, id: card.id };
    if (editorDirty) {
      setPendingEditor(next);
      return;
    }
    setEditor(next);
    updateParams({ card: card.id }, false);
  };
  const createCard = () => {
    setDuplicateSource(null);
    const next = { type: "create" as const };
    if (editorDirty) {
      setPendingEditor(next);
      return;
    }
    setEditor(next);
    updateParams({ card: "new" }, false);
  };
  const openDuplicateDraft = (card: FlashcardDetail) => {
    setDuplicateSource(card);
    setEditor({ type: "create" });
    updateParams({ card: "new" }, false);
  };
  const replacementCardId = (excluded: Set<string>) => {
    const visible = cards.data?.items ?? [];
    return findReplacementStudyItemId(visible, activeId, excluded);
  };
  const showReplacement = (replacementId?: string) => {
    if (replacementId) {
      setEditor({ type: "edit", id: replacementId });
      updateParams({ card: replacementId }, false, true);
    } else {
      setEditor(null);
      updateParams({ card: undefined }, false, true);
    }
  };
  const closeEditor = () => {
    if (editorDirty) {
      setPendingEditor("close");
      return;
    }
    setEditor(null);
    updateParams({ card: undefined }, false, true);
  };
  const performCardAction = async (
    action: StudyItemAction,
    card: FlashcardSummary,
    confirmed = false,
  ) => {
    if (action === "duplicate") return;
    if (action === "delete") return setPendingDelete(card);
    if (action === "archive" && !confirmed) return setPendingArchive(card);
    if (action === "move") {
      setMoveCard(card);
      setMoveTarget(collectionId);
      setMoveOpen(true);
      return;
    }
    try {
      await batch.mutateAsync({ ids: [card.id], action: { type: action } });
      if (activeId === card.id) {
        setEditor(null);
        updateParams({ card: undefined }, false, true);
      }
      toast.success(action === "archive" ? "Flashcard arquivado." : "Flashcard restaurado.");
    } catch (error) {
      toast.error(
        getFlashcardCollectionErrorMessage(error, "Não foi possível atualizar o flashcard."),
      );
    }
  };
  const performBatch = async (type: StudyItemBatchAction) => {
    if (!selected.size) return;
    const selectedIds = new Set(selected);
    const removesActiveCard = Boolean(activeId && selectedIds.has(activeId) && type !== "restore");
    const replacementId = removesActiveCard ? replacementCardId(selectedIds) : undefined;
    try {
      await batch.mutateAsync({ ids: [...selected], action: { type } });
      setSelected(new Set());
      if (removesActiveCard) showReplacement(replacementId);
      if (type === "delete") setBatchDeleteOpen(false);
      toast.success(
        type === "delete"
          ? "Flashcards excluídos."
          : type === "archive"
            ? "Flashcards arquivados."
            : "Flashcards restaurados.",
      );
    } catch (error) {
      toast.error(
        getFlashcardCollectionErrorMessage(error, "Não foi possível alterar os flashcards."),
      );
    }
  };
  const performMove = async () => {
    const ids = moveCard ? [moveCard.id] : [...selected];
    if (!ids.length || moveTarget === collectionId) return;
    const movesActiveCard = Boolean(activeId && ids.includes(activeId));
    try {
      await batch.mutateAsync({
        ids,
        action: { type: "move", collectionId: moveTarget },
      });
      setSelected(new Set());
      setMoveCard(null);
      setMoveOpen(false);
      if (movesActiveCard) {
        setEditor(null);
        updateParams({ card: undefined }, false, true);
      }
      toast.success("Flashcards movidos.");
    } catch (error) {
      toast.error(
        getFlashcardCollectionErrorMessage(error, "Não foi possível mover os flashcards."),
      );
    }
  };

  if (collection.isPending)
    return <StudyWorkspaceSkeleton editorOpen={Boolean(params.get("card"))} />;
  if (collection.isError)
    return (
      <ResourceUnavailable
        backLabel="Voltar aos flashcards"
        backTo="/flashcards"
        notFound={isNotFound(collection.error)}
        onRetry={() => void collection.refetch()}
        title="Coleção não encontrada"
      />
    );

  const summary = collection.data;
  const activeId = editor?.type === "edit" ? editor.id : undefined;
  const appliedFilters =
    Number(input.filter !== "all") +
    Number(input.sort !== "updated") +
    Number(input.status !== "active");
  const narrowed = Boolean(query) || input.filter !== "all" || input.status !== "active";
  return (
    <main className="study-workspace">
      <section className="study-workspace-columns">
        <aside className={cn("min-h-0 flex-col bg-background md:flex", editor ? "hidden" : "flex")}>
          <StudyIndexHeader
            actions={
              <>
                <FlashcardPracticeButton
                  archived={Boolean(summary.archivedAt)}
                  dueCards={summary.dueCards}
                  fullWidthOnMobile={false}
                  onClick={() => setPracticeOpen(true)}
                  size="default"
                  title={summary.title}
                  totalCards={summary.totalCards}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button disabled={Boolean(summary.archivedAt)} variant="outline">
                      <PlusIcon /> Adicionar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={createCard}>
                      <PlusIcon /> Novo flashcard
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setImportOpen(true)}>
                      <UploadIcon /> Importar arquivo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <AiCollectionGenerationAction
                  collectionId={collectionId}
                  defaultProjectId={summary.project?.id}
                  disabled={Boolean(summary.archivedAt)}
                  iconOnly
                  kind="flashcard"
                />
              </>
            }
            backTo="/flashcards"
            meta={`${summary.totalCards} ${summary.totalCards === 1 ? "flashcard" : "flashcards"}`}
            project={summary.project}
            title={summary.title}
          />
          <StudyIndexTools
            selecting={selected.size > 0}
            selection={
              <SelectionBar
                count={selected.size}
                onClear={() => setSelected(new Set())}
                onDelete={() => setBatchDeleteOpen(true)}
                onMove={() => {
                  setMoveTarget(collectionId);
                  setMoveCard(null);
                  setMoveOpen(true);
                }}
                onToggleArchive={() => {
                  if (input.status === "active") setBatchArchiveOpen(true);
                  else void performBatch("restore");
                }}
                status={input.status}
              />
            }
          >
            <SearchInput
              aria-label="Pesquisar flashcards"
              containerClassName="flex-1"
              disabled={!cards.isPending && !query && cards.data?.pagination.totalItems === 0}
              maxLength={200}
              onClear={() => {
                setSearch("");
                updateParams({ query: undefined });
              }}
              onValueChange={setSearch}
              placeholder="Buscar flashcards"
              value={search}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  aria-label={
                    appliedFilters
                      ? `Filtrar e ordenar (${appliedFilters} ${appliedFilters === 1 ? "ativo" : "ativos"})`
                      : "Filtrar e ordenar"
                  }
                  className="relative h-9 shrink-0 px-0"
                  variant="outline"
                >
                  <FilterIcon />
                  <span className="absolute -top-1.5 -right-1.5">
                    <FilterCount count={appliedFilters} />
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] gap-4 p-4">
                <FilterSelect
                  label="Mostrar"
                  value={input.filter}
                  onChange={(value) => updateParams({ filter: value })}
                  options={[
                    ["all", "Todos", ListFilterIcon],
                    ["new", "Novos", NewMemoryMark],
                    ["due", "Para revisar", DueMemoryMark],
                    ["scheduled", "Agendados", ScheduledMemoryMark],
                  ]}
                  separatorBefore={1}
                />
                <FilterSelect
                  label="Ordenar"
                  value={input.sort}
                  onChange={(value) => updateParams({ sort: value })}
                  options={[
                    ["updated", "Atualizados", HistoryIcon],
                    ["created", "Criados", CalendarPlusIcon],
                    ["due", "Próxima revisão", CalendarClockIcon],
                  ]}
                />
                <FilterSelect
                  label="Estado"
                  value={input.status}
                  onChange={(value) => updateParams({ status: value })}
                  options={[
                    ["active", "Ativos", Layers3Icon],
                    ["archived", "Arquivados", ArchiveIcon],
                  ]}
                />
                {appliedFilters > 0 && (
                  <Button
                    className="w-full"
                    onClick={() =>
                      updateParams({
                        filter: "all",
                        sort: "updated",
                        status: "active",
                      })
                    }
                    variant="outline"
                  >
                    Limpar filtros
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          </StudyIndexTools>
          {narrowed && cards.data && (
            /* With no match the empty state says it; the count stays for screen readers only. */
            <p
              aria-live="polite"
              className={cn(
                "study-index-results",
                cards.data.pagination.totalItems === 0 && "sr-only",
              )}
            >
              {resultCount(cards.data.pagination.totalItems, "flashcard", "flashcards")}
            </p>
          )}
          <StudyIndexScroll>
            <StudyItemListState
              createLabel="Criar flashcard"
              emptyIcon={Layers3Icon}
              emptyTitle="Nenhum flashcard ainda"
              guidedElsewhere={input.status === "active"}
              error={cards.isError}
              loading={cards.isPending}
              onCreate={input.status === "active" ? createCard : undefined}
              onRetry={() => void cards.refetch()}
              query={query}
              skeleton={<StudyIndexSkeleton label="Carregando flashcards" />}
              totalItems={cards.data?.pagination.totalItems}
            >
              <FlashcardIndex
                activeId={activeId}
                cards={cards.data?.items ?? []}
                onOpen={openCard}
                onSelect={(id, checked) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (checked) next.add(id);
                    else next.delete(id);
                    return next;
                  })
                }
                query={query}
                selected={selected}
              />
            </StudyItemListState>
          </StudyIndexScroll>
          {cards.data && cards.data.pagination.totalPages > 1 && (
            <div className="border-t border-[var(--line-subtle)] px-2">
              <PaginationControls
                className="mt-0 h-14"
                label="Paginação de flashcards"
                onPageChange={(page) =>
                  updateParams({ page: page > 1 ? String(page) : undefined }, false)
                }
                pagination={cards.data.pagination}
              />
            </div>
          )}
        </aside>
        <div
          className={cn(
            "@container/study-workspace min-h-0 min-w-0 flex-col bg-background md:flex",
            editor ? "flex" : "hidden",
          )}
        >
          {editor && (
            <div className="flex h-12 shrink-0 items-center border-b px-3 md:hidden">
              <Button onClick={closeEditor} size="sm" variant="ghost">
                <ArrowLeftIcon /> Flashcards
              </Button>
            </div>
          )}
          <div className="flex min-h-0 flex-1">
            {editor?.type === "create" && (
              <FlashcardEditorPanel
                collectionId={collectionId}
                initialAnswer={duplicateSource?.answer}
                initialQuestion={duplicateSource?.question}
                key={duplicateSource ? `duplicate-${duplicateSource.id}` : "new"}
                onOpenChange={() => undefined}
                onDirtyChange={setEditorDirty}
                onSaved={(cardId, savedCollectionId) => {
                  setEditorDirty(false);
                  setDuplicateSource(null);
                  if (savedCollectionId !== collectionId) {
                    void navigate(`/flashcards/${savedCollectionId}?card=${cardId}`);
                    return;
                  }
                  setEditor({ type: "edit", id: cardId });
                  updateParams({ card: cardId }, false, true);
                }}
                open
                readOnly={Boolean(summary.archivedAt)}
              />
            )}
            {editor?.type === "edit" && detail.data && (
              <FlashcardEditorPanel
                card={detail.data}
                collectionId={collectionId}
                key={detail.data.id}
                onOpenChange={() => undefined}
                onAction={async (action) => {
                  if (action !== "duplicate") return void performCardAction(action, detail.data);
                  openDuplicateDraft(detail.data);
                }}
                onDirtyChange={setEditorDirty}
                onSaved={(cardId, savedCollectionId) => {
                  setEditorDirty(false);
                  if (savedCollectionId !== collectionId)
                    void navigate(`/flashcards/${savedCollectionId}?card=${cardId}`);
                  else updateParams({ card: cardId }, false, true);
                }}
                open
                readOnly={Boolean(summary.archivedAt)}
              />
            )}
            {editor?.type === "edit" && detail.isPending && <FlashcardEditorSkeleton />}
            {!editor &&
              !cards.isPending &&
              (input.status === "active" && !query && cards.data?.pagination.totalItems === 0 ? (
                <StudyCollectionStart
                  createLabel="Criar flashcard"
                  icon={Layers3Icon}
                  noun="os primeiros flashcards"
                  onCreate={createCard}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                  <div>
                    <Layers3Icon className="mx-auto mb-3 size-7" />
                    <p>Selecione um flashcard ou crie um novo.</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      <ArchiveConfirmation
        description="O flashcard deixará de aparecer entre os materiais ativos, mas poderá ser restaurado."
        disabled={batch.isPending}
        onConfirm={() => {
          if (!pendingArchive) return;
          const card = pendingArchive;
          setPendingArchive(null);
          void performCardAction("archive", card, true);
        }}
        onOpenChange={(open) => !open && setPendingArchive(null)}
        open={Boolean(pendingArchive)}
        title="Arquivar flashcard?"
      />
      <ArchiveConfirmation
        description="Os itens selecionados deixarão de aparecer entre os materiais ativos e poderão ser restaurados posteriormente."
        disabled={batch.isPending}
        onConfirm={() => {
          setBatchArchiveOpen(false);
          void performBatch("archive");
        }}
        onOpenChange={setBatchArchiveOpen}
        open={batchArchiveOpen}
        title={`Arquivar ${selected.size} flashcards?`}
      />

      <DeleteDialogs
        batchDeleteOpen={batchDeleteOpen}
        batchPending={batch.isPending || remove.isPending}
        onBatchDeleteOpenChange={setBatchDeleteOpen}
        onDeleteBatch={() => void performBatch("delete")}
        onDeleteOne={async () => {
          if (!pendingDelete) return;
          try {
            const deletedId = pendingDelete.id;
            const replacementId = replacementCardId(new Set([deletedId]));
            await remove.mutateAsync(deletedId);
            if (activeId === deletedId) showReplacement(replacementId);
            toast.success("Flashcard excluído.");
            setPendingDelete(null);
          } catch (error) {
            toast.error(
              getFlashcardCollectionErrorMessage(error, "Não foi possível excluir o flashcard."),
            );
          }
        }}
        onPendingDeleteChange={setPendingDelete}
        pendingDelete={pendingDelete}
        selectedCount={selected.size}
      />
      <AlertDialog
        open={moveOpen}
        onOpenChange={(open) => {
          setMoveOpen(open);
          if (!open) setMoveCard(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {moveCard ? "Mover flashcard" : `Mover ${selected.size} flashcards`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Escolha outra coleção para {moveCard ? "este card" : "os cards selecionados"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <CollectionPicker onChange={setMoveTarget} value={moveTarget} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              disabled={batch.isPending || moveTarget === collectionId}
              onClick={() => void performMove()}
            >
              Mover
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PracticeSetupDialog
        collectionId={collectionId}
        onOpenChange={setPracticeOpen}
        open={practiceOpen}
      />
      <FlashcardImportDialog
        collectionId={collectionId}
        onOpenChange={setImportOpen}
        open={importOpen}
      />
      <ConfirmationDialog
        actionLabel="Descartar"
        cancelLabel="Continuar editando"
        description="A pergunta ou resposta atual ainda não foi salva."
        destructive
        onConfirm={() => {
          if (!pendingEditor) return;
          const next = pendingEditor;
          setPendingEditor(null);
          setEditorDirty(false);
          if (next === "close") {
            setEditor(null);
            updateParams({ card: undefined }, false, true);
            return;
          }
          setEditor(next);
          updateParams({ card: next.type === "create" ? "new" : next.id }, false);
        }}
        open={Boolean(pendingEditor)}
        onOpenChange={(open) => !open && setPendingEditor(null)}
        title="Descartar alterações?"
      />
    </main>
  );
};

const SelectionBar = ({
  count,
  onClear,
  onDelete,
  onMove,
  onToggleArchive,
  status,
}: {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  onMove: () => void;
  onToggleArchive: () => void;
  status: string;
}) => (
  <StudyItemSummaryBar
    count={count}
    itemLabel={{ singular: "selecionado", plural: "selecionados" }}
    onClear={onClear}
    onDelete={onDelete}
    onMove={onMove}
    onToggleArchive={onToggleArchive}
    status={status === "archived" ? "archived" : "active"}
  />
);

const ArchiveConfirmation = ({
  description,
  disabled,
  onConfirm,
  onOpenChange,
  open,
  title,
}: {
  description: string;
  disabled: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) => (
  <ConfirmationDialog
    actionLabel="Arquivar"
    description={description}
    disabled={disabled}
    media={<ArchiveIcon />}
    onConfirm={onConfirm}
    onOpenChange={onOpenChange}
    open={open}
    title={title}
  />
);

const DeleteDialogs = ({
  batchDeleteOpen,
  batchPending,
  onBatchDeleteOpenChange,
  onDeleteBatch,
  onDeleteOne,
  onPendingDeleteChange,
  pendingDelete,
  selectedCount,
}: {
  batchDeleteOpen: boolean;
  batchPending: boolean;
  onBatchDeleteOpenChange: (open: boolean) => void;
  onDeleteBatch: () => void;
  onDeleteOne: () => void;
  onPendingDeleteChange: (card: FlashcardSummary | null) => void;
  pendingDelete: FlashcardSummary | null;
  selectedCount: number;
}) => (
  <>
    <ConfirmationDialog
      actionLabel="Excluir"
      description="O conteúdo e todo o histórico deste card serão excluídos definitivamente."
      destructive
      disabled={batchPending}
      media={<Trash2Icon />}
      open={Boolean(pendingDelete)}
      onOpenChange={(open) => !open && onPendingDeleteChange(null)}
      onConfirm={onDeleteOne}
      title="Excluir flashcard?"
    />
    <ConfirmationDialog
      actionLabel="Excluir"
      description="Os conteúdos e históricos selecionados serão excluídos definitivamente."
      destructive
      disabled={batchPending}
      media={<Trash2Icon />}
      onConfirm={onDeleteBatch}
      onOpenChange={onBatchDeleteOpenChange}
      open={batchDeleteOpen}
      title={`Excluir ${selectedCount} flashcards?`}
    />
  </>
);

const FlashcardEditorSkeleton = ({ className }: { className?: string }) => (
  <div
    aria-label="Carregando conteúdo do flashcard"
    className={cn("min-h-0 flex-1 flex-col px-6 py-6 sm:px-10", className ?? "flex")}
    role="status"
  >
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="pt-[clamp(2.5rem,7vh,5rem)]">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-5 h-9 w-[85%]" />
        <Skeleton className="mt-3 h-9 w-[58%]" />
        <div className="my-10 flex items-center gap-3">
          <Skeleton className="h-px flex-1" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-px flex-1" />
        </div>
        <Skeleton className="h-6 w-[78%]" />
        <Skeleton className="mt-3 h-6 w-[52%]" />
      </div>
    </div>
    <span className="sr-only">Carregando conteúdo...</span>
  </div>
);

export default FlashcardCollectionPage;
