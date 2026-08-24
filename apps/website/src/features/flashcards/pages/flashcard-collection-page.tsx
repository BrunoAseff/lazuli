import {
  FLASHCARD_PAGE_SIZE,
  flashcardListQuerySchema,
  type FlashcardSummary,
} from "@lazuli/shared";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  CalendarClockIcon,
  CalendarPlusIcon,
  ClockAlertIcon,
  HistoryIcon,
  Layers3Icon,
  ListFilterIcon,
  MoveRightIcon,
  PlusIcon,
  SparklesIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { PaginationControls } from "@/components/pagination-controls.tsx";
import { ViewModeToggle, type ViewMode } from "@/components/view-mode-toggle.tsx";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  useBatchFlashcards,
  useDeleteFlashcard,
  useFlashcard,
  useFlashcardCollection,
  useFlashcards,
} from "../api/flashcard-queries.ts";
import { CollectionPicker, FlashcardEditorDialog } from "../components/flashcard-editor-sheet.tsx";
import { FlashcardItems } from "../components/flashcard-items.tsx";
import { FlashcardImportDialog } from "../components/flashcard-import-dialog.tsx";
import { PracticeSetupDialog } from "../components/practice-setup-dialog.tsx";
import { getFlashcardCollectionErrorMessage } from "../flashcard-messages.ts";

const parsePage = (value: string | null) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

export const FlashcardCollectionPage = () => {
  const { collectionId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const query = params.get("query")?.slice(0, 200).trim() ?? "";
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
  const [view, setView] = useState<ViewMode>(() =>
    localStorage.getItem("lazuli-flashcard-view") === "cards" ? "cards" : "table",
  );
  const [selected, setSelected] = useState(new Set<string>());
  const [editor, setEditor] = useState<
    { type: "create" } | { type: "edit"; cardId: string } | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<FlashcardSummary | null>(null);
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

  const updateParams = (changes: Record<string, string | undefined>, resetPage = true) =>
    setParams((current) => {
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
    });

  useEffect(() => setSearch(query), [query]);
  useEffect(() => {
    const normalized = search.trim();
    if (normalized === query) return;
    const timer = window.setTimeout(() => updateParams({ query: normalized || undefined }), 300);
    return () => window.clearTimeout(timer);
  }, [query, search]);
  useEffect(() => setSelected(new Set()), [input.page, input.filter, input.query, input.status]);
  useEffect(() => {
    const totalPages = cards.data?.pagination.totalPages;
    if (totalPages !== undefined && input.page > Math.max(totalPages, 1)) {
      updateParams({ page: totalPages > 1 ? String(totalPages) : undefined }, false);
    }
  }, [cards.data?.pagination.totalPages, input.page]);

  const performCardAction = async (
    action: "archive" | "delete" | "move" | "restore",
    card: FlashcardSummary,
  ) => {
    if (action === "delete") {
      setPendingDelete(card);
      return;
    }
    if (action === "move") {
      setMoveCard(card);
      setMoveTarget(collectionId);
      setMoveOpen(true);
      return;
    }
    try {
      await batch.mutateAsync({ ids: [card.id], action: { type: action } });
      toast.success(action === "archive" ? "Flashcard arquivado." : "Flashcard restaurado.");
    } catch (error) {
      toast.error(
        getFlashcardCollectionErrorMessage(error, "Não foi possível atualizar o flashcard."),
      );
    }
  };

  const performBatch = async (type: "archive" | "delete" | "restore") => {
    if (!selected.size) return;
    try {
      await batch.mutateAsync({ ids: [...selected], action: { type } });
      setSelected(new Set());
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
    try {
      await batch.mutateAsync({
        ids,
        action: { type: "move", collectionId: moveTarget },
      });
      setSelected(new Set());
      setMoveCard(null);
      setMoveOpen(false);
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
      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
        <p className="font-heading text-2xl">Coleção não encontrada</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/flashcards">Voltar</Link>
        </Button>
      </main>
    );

  const summary = collection.data;
  return (
    <main className="flex flex-1 flex-col px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          to="/flashcards"
        >
          <ArrowLeftIcon className="size-4" /> Flashcards
        </Link>
        <header className="flex flex-col gap-6 border-b pb-7 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Coleção de flashcards
            </p>
            <h1 className="truncate font-heading text-4xl font-medium sm:text-5xl">
              {summary.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {summary.project?.title ?? "Sem projeto"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={Boolean(summary.archivedAt)}
              onClick={() => setImportOpen(true)}
              variant="outline"
            >
              <UploadIcon /> Importar
            </Button>
            <Button
              disabled={Boolean(summary.archivedAt)}
              onClick={() => setEditor({ type: "create" })}
              variant="outline"
            >
              <PlusIcon /> Novo flashcard
            </Button>
            <Button
              disabled={Boolean(summary.archivedAt) || summary.dueCards === 0}
              onClick={() => setPracticeOpen(true)}
            >
              Praticar ({summary.dueCards})
            </Button>
          </div>
        </header>

        <section
          aria-label="Resumo da coleção"
          className="grid grid-cols-2 gap-px border-b bg-border md:grid-cols-4"
        >
          <Metric label="Novos" value={summary.newCards} />
          <Metric label="Estudados" value={summary.studiedCards} />
          <Metric label="Para revisar" value={summary.dueCards} />
          <Metric
            label="Próxima revisão"
            value={
              summary.dueCards
                ? "Agora"
                : summary.nextPracticeAt
                  ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
                      new Date(summary.nextPracticeAt),
                    )
                  : "—"
            }
          />
        </section>

        <div className="my-7 flex flex-col gap-3 border-y py-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Pesquisar flashcards"
              className="pr-9 pl-9"
              maxLength={200}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar pergunta ou resposta"
              value={search}
            />
            {search && (
              <Button
                aria-label="Limpar pesquisa"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => {
                  setSearch("");
                  updateParams({ query: undefined });
                }}
                size="icon-sm"
                variant="ghost"
              >
                <XIcon />
              </Button>
            )}
          </div>
          <Select onValueChange={(value) => updateParams({ filter: value })} value={input.filter}>
            <SelectTrigger aria-label="Filtrar cards" className="w-full lg:w-40">
              <SelectValue>
                {input.filter === "all" && <ListFilterIcon />}
                {input.filter === "new" && <SparklesIcon />}
                {input.filter === "due" && <ClockAlertIcon />}
                {input.filter === "scheduled" && <CalendarClockIcon />}
                {
                  { all: "Todos", new: "Novos", due: "Para revisar", scheduled: "Agendados" }[
                    input.filter
                  ]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <ListFilterIcon /> Todos
              </SelectItem>
              <SelectSeparator />
              <SelectItem value="new">
                <SparklesIcon /> Novos
              </SelectItem>
              <SelectItem value="due">
                <ClockAlertIcon /> Para revisar
              </SelectItem>
              <SelectItem value="scheduled">
                <CalendarClockIcon /> Agendados
              </SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={(value) => updateParams({ sort: value })} value={input.sort}>
            <SelectTrigger aria-label="Ordenar cards" className="w-full lg:w-44">
              <SelectValue>
                {input.sort === "updated" && <HistoryIcon />}
                {input.sort === "created" && <CalendarPlusIcon />}
                {input.sort === "due" && <CalendarClockIcon />}
                {{ updated: "Atualizados", created: "Criados", due: "Próxima revisão" }[input.sort]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">
                <HistoryIcon /> Atualizados
              </SelectItem>
              <SelectItem value="created">
                <CalendarPlusIcon /> Criados
              </SelectItem>
              <SelectItem value="due">
                <CalendarClockIcon /> Próxima revisão
              </SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={(value) => updateParams({ status: value })} value={input.status}>
            <SelectTrigger aria-label="Estado dos cards" className="w-full lg:w-36">
              <SelectValue>
                {input.status === "active" ? <Layers3Icon /> : <ArchiveIcon />}
                {input.status === "active" ? "Ativos" : "Arquivados"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">
                <Layers3Icon /> Ativos
              </SelectItem>
              <SelectItem value="archived">
                <ArchiveIcon /> Arquivados
              </SelectItem>
            </SelectContent>
          </Select>
          <div className="lg:ml-auto">
            <ViewModeToggle
              label="Visualização dos flashcards"
              onChange={(next) => {
                setView(next);
                localStorage.setItem("lazuli-flashcard-view", next);
              }}
              value={view}
            />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 border bg-popover px-3 py-2 shadow-lg sm:bottom-6 sm:w-auto sm:justify-start">
            <span className="w-full text-sm sm:mr-auto sm:w-auto">
              {selected.size} {selected.size === 1 ? "selecionado" : "selecionados"}
              <span className="hidden sm:inline"> nesta página</span>
            </span>
            <Button
              disabled={batch.isPending}
              onClick={() => {
                setMoveTarget(collectionId);
                setMoveCard(null);
                setMoveOpen(true);
              }}
              size="sm"
              variant="outline"
            >
              <MoveRightIcon /> Mover
            </Button>
            {input.status === "active" ? (
              <Button
                disabled={batch.isPending}
                onClick={() => void performBatch("archive")}
                size="sm"
                variant="outline"
              >
                <ArchiveIcon /> Arquivar
              </Button>
            ) : (
              <Button
                disabled={batch.isPending}
                onClick={() => void performBatch("restore")}
                size="sm"
                variant="outline"
              >
                Restaurar
              </Button>
            )}
            <Button
              disabled={batch.isPending}
              onClick={() => setBatchDeleteOpen(true)}
              size="sm"
              variant="destructive"
            >
              <Trash2Icon /> Excluir
            </Button>
          </div>
        )}

        {cards.isPending && (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton className="h-20" key={index} />
            ))}
          </div>
        )}
        {cards.isError && (
          <div className="border border-dashed p-10 text-center">
            <p>Não foi possível carregar os flashcards.</p>
            <Button className="mt-4" onClick={() => void cards.refetch()} variant="outline">
              Tentar novamente
            </Button>
          </div>
        )}
        {cards.data?.pagination.totalItems === 0 && (
          <div className="border border-dashed px-5 py-16 text-center">
            <Layers3Icon className="mx-auto mb-4 size-7 text-muted-foreground" />
            <h2 className="font-heading text-2xl">
              {query
                ? "Nenhum flashcard encontrado"
                : input.status === "archived"
                  ? "Nenhum flashcard arquivado"
                  : "Nenhum flashcard ainda"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {query
                ? "Tente pesquisar por outros termos."
                : "Crie perguntas e respostas para começar a estudar esta coleção."}
            </p>
            {!query && input.status === "active" && (
              <Button className="mt-5" onClick={() => setEditor({ type: "create" })}>
                <PlusIcon /> Criar flashcard
              </Button>
            )}
          </div>
        )}
        {cards.data && cards.data.items.length > 0 && (
          <FlashcardItems
            cards={cards.data.items}
            editable={!summary.archivedAt}
            mode={view}
            onAction={(action, card) => void performCardAction(action, card)}
            onEdit={(card) => setEditor({ type: "edit", cardId: card.id })}
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
        )}
        {cards.data && (
          <PaginationControls
            label="Paginação de flashcards"
            onPageChange={(page) =>
              updateParams({ page: page > 1 ? String(page) : undefined }, false)
            }
            pagination={cards.data.pagination}
          />
        )}
      </div>

      {editor?.type === "create" && (
        <FlashcardEditorDialog
          collectionId={collectionId}
          onOpenChange={(open) => !open && setEditor(null)}
          open
        />
      )}
      {editor?.type === "edit" && detail.data && (
        <FlashcardEditorDialog
          card={detail.data}
          collectionId={collectionId}
          onOpenChange={(open) => !open && setEditor(null)}
          open
        />
      )}
      {editor?.type === "edit" && detail.isPending && (
        <div
          aria-live="polite"
          className="fixed right-5 bottom-5 rounded-md bg-popover px-4 py-3 text-sm shadow-md"
        >
          Carregando flashcard…
        </div>
      )}
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
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
            <Button
              disabled={remove.isPending}
              onClick={async () => {
                if (!pendingDelete) return;
                try {
                  await remove.mutateAsync(pendingDelete.id);
                  toast.success("Flashcard excluído.");
                  setPendingDelete(null);
                } catch (error) {
                  toast.error(
                    getFlashcardCollectionErrorMessage(
                      error,
                      "Não foi possível excluir o flashcard.",
                    ),
                  );
                }
              }}
              variant="destructive"
            >
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selected.size} flashcards?</AlertDialogTitle>
            <AlertDialogDescription>
              Os conteúdos e históricos selecionados serão excluídos definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              disabled={batch.isPending}
              onClick={() => void performBatch("delete")}
              variant="destructive"
            >
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    </main>
  );
};

const Metric = ({ label, value }: { label: string; value: number | string }) => (
  <div className="bg-background px-4 py-5">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 font-heading text-2xl">{value}</p>
  </div>
);
const CollectionSkeleton = () => (
  <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
    <Skeleton className="h-5 w-24" />
    <Skeleton className="mt-8 h-12 w-80 max-w-full" />
    <Skeleton className="mt-8 h-24 w-full" />
    <Skeleton className="mt-8 h-80 w-full" />
  </main>
);

export default FlashcardCollectionPage;
