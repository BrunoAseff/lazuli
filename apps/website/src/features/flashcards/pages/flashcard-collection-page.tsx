import {
  FLASHCARD_PAGE_SIZE,
  flashcardListQuerySchema,
  type FlashcardSummary,
} from "@lazuli/shared";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowLeftIcon,
  CalendarClockIcon,
  CalendarPlusIcon,
  ClockAlertIcon,
  FilterIcon,
  HistoryIcon,
  Layers3Icon,
  ListFilterIcon,
  MoveRightIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  SearchXIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { Fragment, useEffect, useState, type ComponentType, type Ref } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { PaginationControls } from "@/components/pagination-controls.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
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
import { Input } from "@/components/ui/input.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
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

const parsePage = (value: string | null) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

type EditorState = { type: "create" } | { type: "edit"; cardId: string } | null;
type PendingEditorState = Exclude<EditorState, null> | "close" | null;
type CardAction = "archive" | "delete" | "move" | "restore";

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
    page: parsePage(params.get("page")),
    pageSize: FLASHCARD_PAGE_SIZE,
  });
  const [search, setSearch] = useState(query);
  const [selected, setSelected] = useState(new Set<string>());
  const [editor, setEditor] = useState<EditorState>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [pendingEditor, setPendingEditor] = useState<PendingEditorState>(null);
  const compact = useCompactLayout();
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
    const next = { type: "create" as const };
    if (editorDirty) {
      setPendingEditor(next);
      return;
    }
    setEditor(next);
    updateParams({ card: "new" }, false);
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
    const removesActiveCard = Boolean(activeId && selected.has(activeId) && type !== "restore");
    try {
      await batch.mutateAsync({ ids: [...selected], action: { type } });
      setSelected(new Set());
      if (removesActiveCard) {
        setEditor(null);
        updateParams({ card: undefined }, false, true);
      }
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
      await batch.mutateAsync({ ids, action: { type: "move", collectionId: moveTarget } });
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
                size="sm"
              >
                <PlayIcon aria-hidden="true" className="-translate-y-px" /> Praticar{" "}
                {summary.dueCards}
              </Button>
            </div>
          </header>
          <div className="flex items-center gap-2 p-3">
            <SearchBox
              disabled={!cards.isPending && !query && cards.data?.pagination.totalItems === 0}
              search={search}
              setSearch={setSearch}
              clear={() => {
                setSearch("");
                updateParams({ query: undefined });
              }}
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
                      updateParams({ filter: "all", sort: "updated", status: "active" })
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
            {cards.isPending && <FlashcardIndexSkeleton />}
            {cards.isError && (
              <div className="p-5 text-center text-sm">
                <p>Não foi possível carregar.</p>
                <Button
                  className="mt-3"
                  onClick={() => void cards.refetch()}
                  size="sm"
                  variant="outline"
                >
                  Tentar novamente
                </Button>
              </div>
            )}
            {cards.data?.pagination.totalItems === 0 && (
              <div className="px-3 py-10 text-center">
                {query ? (
                  <SearchXIcon className="mx-auto mb-3 size-6 text-muted-foreground" />
                ) : (
                  <Layers3Icon className="mx-auto mb-3 size-6 text-muted-foreground" />
                )}
                <p className="font-heading text-lg">
                  {query ? "Nenhum resultado" : "Nenhum flashcard ainda"}
                </p>
                {!query && input.status === "active" && (
                  <Button className="mt-4" onClick={createCard} size="sm">
                    <PlusIcon /> Criar flashcard
                  </Button>
                )}
              </div>
            )}
            {cards.data?.items.length ? (
              <FlashcardIndex
                activeId={activeId}
                cards={cards.data.items}
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
            ) : null}
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
                key="new"
                onOpenChange={() => undefined}
                onDirtyChange={setEditorDirty}
                onSaved={(cardId, savedCollectionId) => {
                  setEditorDirty(false);
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
                onAction={(action) => void performCardAction(action, detail.data)}
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
            await remove.mutateAsync(deletedId);
            if (activeId === deletedId) {
              setEditor(null);
              updateParams({ card: undefined }, false, true);
            }
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
      <AlertDialog
        open={Boolean(pendingEditor)}
        onOpenChange={(open) => !open && setPendingEditor(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              A pergunta ou resposta atual ainda não foi salva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <Button
              onClick={() => {
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
              variant="destructive"
            >
              Descartar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};

const SearchBox = ({
  clear,
  disabled,
  search,
  setSearch,
}: {
  clear: () => void;
  disabled: boolean;
  search: string;
  setSearch: (value: string) => void;
}) => (
  <div className="relative min-w-0 flex-1">
    <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input
      aria-label="Pesquisar flashcards"
      className="pr-8 pl-9"
      disabled={disabled}
      maxLength={200}
      onChange={(event) => setSearch(event.target.value)}
      placeholder="Buscar materiais"
      value={search}
    />
    {search && (
      <Button
        aria-label="Limpar pesquisa"
        className="absolute top-1/2 right-1 -translate-y-1/2"
        onClick={clear}
        size="icon-sm"
        variant="ghost"
      >
        <XIcon />
      </Button>
    )}
  </div>
);

type FilterOption = readonly [string, string, ComponentType<{ className?: string }>];
const FilterSelect = ({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<FilterOption>;
  value: string;
}) => (
  <div className="space-y-2">
    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([optionValue, optionLabel, Icon], index) => (
          <Fragment key={optionValue}>
            {index === 1 && label === "Mostrar" && <SelectSeparator />}
            <SelectItem value={optionValue}>
              <Icon className="size-4" /> {optionLabel}
            </SelectItem>
          </Fragment>
        ))}
      </SelectContent>
    </Select>
  </div>
);

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
  <div className="flex h-12 shrink-0 items-center border-y px-3 text-xs text-muted-foreground">
    {count ? (
      <div className="flex w-full min-w-0 items-center gap-1">
        <span className="mr-auto truncate text-foreground">
          {count} {count === 1 ? "selecionado" : "selecionados"}
        </span>
        <Button onClick={onClear} size="xs" variant="ghost">
          Desmarcar
        </Button>
        <Button aria-label="Mover selecionados" onClick={onMove} size="icon-sm" variant="outline">
          <MoveRightIcon />
        </Button>
        <Button
          aria-label={status === "active" ? "Arquivar selecionados" : "Restaurar selecionados"}
          onClick={onToggleArchive}
          size="icon-sm"
          variant="outline"
        >
          {status === "active" ? <ArchiveIcon /> : <ArchiveRestoreIcon />}
        </Button>
        <Button
          aria-label="Excluir selecionados"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          size="icon-sm"
          variant="outline"
        >
          <Trash2Icon />
        </Button>
      </div>
    ) : (
      <div className="w-full min-w-0 leading-4">
        <p className="truncate text-foreground">
          {total} {total === 1 ? "flashcard" : "flashcards"} · {studied} de {totalCards} estudados ·{" "}
          {due} disponíveis
        </p>
        <p className="truncate">
          {reviews === 0
            ? "Sem revisões nos últimos 7 dias"
            : `${reviews} ${reviews === 1 ? "revisão" : "revisões"} nos últimos 7 dias`}
        </p>
      </div>
    )}
  </div>
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
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancelar</AlertDialogCancel>
        <Button disabled={disabled} onClick={onConfirm}>
          <ArchiveIcon /> Arquivar
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
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
    <AlertDialog
      open={Boolean(pendingDelete)}
      onOpenChange={(open) => !open && onPendingDeleteChange(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir flashcard?</AlertDialogTitle>
          <AlertDialogDescription>
            O conteúdo e todo o histórico deste card serão excluídos definitivamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button disabled={batchPending} onClick={onDeleteOne} variant="destructive">
            <Trash2Icon /> Excluir
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={batchDeleteOpen} onOpenChange={onBatchDeleteOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {selectedCount} flashcards?</AlertDialogTitle>
          <AlertDialogDescription>
            Os conteúdos e históricos selecionados serão excluídos definitivamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button disabled={batchPending} onClick={onDeleteBatch} variant="destructive">
            <Trash2Icon /> Excluir
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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

const useCompactLayout = () => {
  const [compact, setCompact] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(max-width: 767px)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return compact;
};

export default FlashcardCollectionPage;
