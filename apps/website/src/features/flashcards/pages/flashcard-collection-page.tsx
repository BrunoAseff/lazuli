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
  BookOpenCheckIcon,
  ClockAlertIcon,
  FilterIcon,
  HistoryIcon,
  Layers3Icon,
  ListFilterIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useEffect, useState, type Ref } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { FilterSelect } from "@/components/filter-select.tsx";
import { ConfirmationDialog } from "@/components/confirmation-dialog.tsx";
import { PaginationControls } from "@/components/pagination-controls.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { SearchInput } from "@/components/search-input.tsx";
import { StudyItemSummaryBar } from "@/components/study-item-summary-bar.tsx";
import { StudyItemListState } from "@/components/study-item-list-state.tsx";
import { StudySummaryMetric } from "@/components/study-summary-metric.tsx";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { cn } from "@/lib/utils.ts";
import { parsePositivePage } from "@/lib/pagination.ts";
import {
  useBatchFlashcards,
  useDeleteFlashcard,
  useFlashcard,
  useFlashcardCollection,
  useFlashcards,
} from "../api/flashcard-queries.ts";
import { CollectionPicker, FlashcardEditorPanel } from "../components/flashcard-editor-sheet.tsx";
import { FlashcardIndex } from "../components/flashcard-items.tsx";
import { FlashcardImportDialog } from "../components/flashcard-import-dialog.tsx";
import { PracticeSetupDialog } from "../components/practice-setup-dialog.tsx";
import { getFlashcardCollectionErrorMessage } from "../flashcard-messages.ts";

type EditorState = { type: "create" } | { type: "edit"; cardId: string } | null;
type PendingEditorState = Exclude<EditorState, null> | "close" | null;
type CardAction = "archive" | "delete" | "duplicate" | "move" | "restore";

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
  const [search, setSearch] = useState(query);
  const [selected, setSelected] = useState(new Set<string>());
  const [editor, setEditor] = useState<EditorState>(null);
  const [duplicateSource, setDuplicateSource] = useState<FlashcardDetail | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [pendingEditor, setPendingEditor] = useState<PendingEditorState>(null);
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
  const cards = useFlashcards(collectionId, input);
  const detail = useFlashcard(collectionId, editor?.type === "edit" ? editor.cardId : null);
  const batch = useBatchFlashcards(collectionId);
  const remove = useDeleteFlashcard(collectionId);

  const updateParams = (
    changes: Record<string, string | undefined>,
    resetPage = true,
    replace = false,
  ) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (
            !value ||
            (key === "filter" && value === "all") ||
            (key === "sort" && value === "updated") ||
            (key === "status" && value === "active")
          )
            next.delete(key);
          else next.set(key, value);
        }
        if (resetPage) next.delete("page");
        return next;
      },
      { replace },
    );

  useEffect(() => {
    if (linkedCardId)
      setEditor(
        linkedCardId === "new" ? { type: "create" } : { type: "edit", cardId: linkedCardId },
      );
  }, [linkedCardId]);
  useEffect(() => {
    const normalized = search.trim();
    if (normalized === query) return;
    const timer = window.setTimeout(() => updateParams({ query: normalized || undefined }), 300);
    return () => window.clearTimeout(timer);
  }, [query, search]);
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
    setEditor({ type: "edit", cardId: first.id });
    updateParams({ card: first.id }, false, true);
  }, [cards.data?.items, compact, editor, linkedCardId]);

  const openCard = (card: FlashcardSummary) => {
    if (activeId === card.id) return;
    const next = { type: "edit" as const, cardId: card.id };
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
    const activeIndex = visible.findIndex(({ id }) => id === activeId);
    const candidates =
      activeIndex >= 0
        ? [...visible.slice(activeIndex + 1), ...visible.slice(0, activeIndex)]
        : visible;
    return candidates.find(({ id }) => !excluded.has(id))?.id;
  };
  const showReplacement = (replacementId?: string) => {
    if (replacementId) {
      setEditor({ type: "edit", cardId: replacementId });
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
    action: CardAction,
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
  const performBatch = async (type: "archive" | "delete" | "restore") => {
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

  if (collection.isPending) return <CollectionSkeleton />;
  if (collection.isError)
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
        <p className="font-heading text-2xl">Coleção não encontrada</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/flashcards">Voltar</Link>
        </Button>
      </main>
    );

  const summary = collection.data;
  const activeId = editor?.type === "edit" ? editor.cardId : undefined;
  const appliedFilters =
    Number(input.filter !== "all") +
    Number(input.sort !== "updated") +
    Number(input.status !== "active");
  return (
    <main className="h-[calc(100dvh-3.5rem)] min-h-0 max-h-[calc(100dvh-3.5rem)] flex-none overflow-hidden md:h-dvh md:max-h-dvh">
      <section className="grid h-full min-h-0 w-full md:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside
          className={cn(
            "min-h-0 flex-col bg-background md:flex md:border-r",
            editor ? "hidden" : "flex",
          )}
        >
          <header className="px-5 pt-5 pb-3">
            <Link
              className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              to="/flashcards"
            >
              <ArrowLeftIcon className="size-3.5" /> Coleções
            </Link>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <OverflowTooltip text={summary.title}>
                  {(ref) => (
                    <h1
                      className="truncate font-heading text-xl font-normal"
                      ref={ref as Ref<HTMLHeadingElement>}
                    >
                      {summary.title}
                    </h1>
                  )}
                </OverflowTooltip>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {summary.project?.title ?? "Sem projeto"}
                </p>
              </div>
              <Button
                className="shrink-0"
                disabled={Boolean(summary.archivedAt) || summary.dueCards === 0}
                onClick={() => setPracticeOpen(true)}
                size="lg"
              >
                <PlayIcon aria-hidden="true" className="-translate-y-px" /> Praticar
              </Button>
            </div>
          </header>
          <div className="flex items-center gap-2 px-5 py-3">
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
              placeholder="Buscar materiais"
              value={search}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  aria-label="Filtrar e ordenar"
                  className="relative"
                  size="icon"
                  variant="outline"
                >
                  <FilterIcon />
                  {appliedFilters > 0 && (
                    <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[0.625rem] text-primary-foreground">
                      {appliedFilters}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 gap-4 p-4">
                <FilterSelect
                  label="Mostrar"
                  value={input.filter}
                  onChange={(value) => updateParams({ filter: value })}
                  options={[
                    ["all", "Todos", ListFilterIcon],
                    ["new", "Novos", PlusIcon],
                    ["due", "Para revisar", ClockAlertIcon],
                    ["scheduled", "Agendados", CalendarClockIcon],
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
            <Button
              aria-label="Importar flashcards"
              disabled={Boolean(summary.archivedAt)}
              onClick={() => setImportOpen(true)}
              size="icon"
              variant="outline"
            >
              <UploadIcon />
            </Button>
            <Button
              aria-label="Novo flashcard"
              disabled={Boolean(summary.archivedAt)}
              onClick={createCard}
              size="icon"
            >
              <PlusIcon />
            </Button>
          </div>
          <SelectionBar
            count={selected.size}
            due={summary.dueCards}
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
            studied={summary.studiedCards}
            total={cards.data?.pagination.totalItems ?? 0}
            totalCards={summary.totalCards}
            reviews={summary.reviewsLastSevenDays}
          />
          <div className="min-h-0 flex-1 overflow-y-auto p-2 lazuli-thin-scrollbar">
            <StudyItemListState
              createLabel="Criar flashcard"
              emptyIcon={Layers3Icon}
              emptyTitle="Nenhum flashcard ainda"
              error={cards.isError}
              loading={cards.isPending}
              onCreate={input.status === "active" ? createCard : undefined}
              onRetry={() => void cards.refetch()}
              query={query}
              skeleton={<FlashcardIndexSkeleton />}
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
          </div>
          {cards.data && cards.data.pagination.totalPages > 1 && (
            <div className="border-t px-2">
              <PaginationControls
                className="mt-0 h-16"
                label="Paginação de flashcards"
                onPageChange={(page) =>
                  updateParams({ page: page > 1 ? String(page) : undefined }, false)
                }
                pagination={cards.data.pagination}
              />
            </div>
          )}
        </aside>
        <div className={cn("min-h-0 min-w-0 flex-col bg-card md:flex", editor ? "flex" : "hidden")}>
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
                  setEditor({ type: "edit", cardId });
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
            {!editor && !cards.isPending && (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                <div>
                  <Layers3Icon className="mx-auto mb-3 size-7" />
                  <p>Selecione um flashcard ou crie um novo.</p>
                </div>
              </div>
            )}
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
          updateParams({ card: next.type === "create" ? "new" : next.cardId }, false);
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
  due,
  onClear,
  onDelete,
  onMove,
  onToggleArchive,
  status,
  studied,
  total,
  totalCards,
  reviews,
}: {
  count: number;
  due: number;
  onClear: () => void;
  onDelete: () => void;
  onMove: () => void;
  onToggleArchive: () => void;
  status: string;
  studied: number;
  total: number;
  totalCards: number;
  reviews: number;
}) => (
  <StudyItemSummaryBar
    count={count}
    itemLabel={{ singular: "selecionado", plural: "selecionados" }}
    onClear={onClear}
    onDelete={onDelete}
    onMove={onMove}
    onToggleArchive={onToggleArchive}
    status={status === "archived" ? "archived" : "active"}
  >
    <StudySummaryMetric icon={Layers3Icon} strong>
      {total} {total === 1 ? "flashcard" : "flashcards"}
    </StudySummaryMetric>
    <StudySummaryMetric icon={BookOpenCheckIcon}>
      {studied} de {totalCards} estudados
    </StudySummaryMetric>
    <StudySummaryMetric icon={CalendarClockIcon}>{due} disponíveis</StudySummaryMetric>
    <StudySummaryMetric icon={RotateCcwIcon}>
      {reviews === 0
        ? "Sem revisões nos últimos 7 dias"
        : `${reviews} ${reviews === 1 ? "revisão" : "revisões"} nos últimos 7 dias`}
    </StudySummaryMetric>
  </StudyItemSummaryBar>
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

const CollectionSkeleton = () => (
  <main className="grid h-[calc(100dvh-3.5rem)] min-h-0 md:h-dvh md:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]">
    <aside className="border-r px-5 py-5">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="mt-5 h-7 w-40" />
      <Skeleton className="mt-2 h-3 w-24" />
      <Skeleton className="mt-7 h-9 w-full" />
      <div className="mt-8">
        <FlashcardIndexSkeleton />
      </div>
    </aside>
    <FlashcardEditorSkeleton className="hidden md:flex" />
  </main>
);

const FlashcardIndexSkeleton = () => (
  <div aria-label="Carregando flashcards" className="space-y-1" role="status">
    {Array.from({ length: 7 }, (_, index) => (
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 px-2 py-2.5" key={index}>
        <Skeleton className="mt-0.5 size-4" />
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-4" style={{ width: `${72 + (index % 3) * 8}%` }} />
          <Skeleton className="h-3 w-32 max-w-[65%]" />
        </div>
      </div>
    ))}
    <span className="sr-only">Carregando flashcards...</span>
  </div>
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
