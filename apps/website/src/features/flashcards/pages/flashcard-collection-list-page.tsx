import {
  FLASHCARD_COLLECTION_PAGE_SIZE,
  flashcardCollectionProjectFilterSchema,
  flashcardCollectionListQuerySchema,
  type FlashcardCollectionSummary,
  type FlashcardCollectionStatus,
} from "@lazuli/shared";
import { PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { PaginationControls } from "@/components/pagination-controls.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import {
  useFlashcardCollections,
  useRestoreFlashcardCollection,
} from "../api/flashcard-collection-queries.ts";
import {
  ArchiveFlashcardCollectionDialog,
  DeleteFlashcardCollectionDialog,
  FlashcardCollectionDialog,
} from "../components/flashcard-collection-dialogs.tsx";
import { FlashcardCollectionList } from "../components/flashcard-collection-list.tsx";
import {
  EmptyFlashcardCollections,
  FlashcardCollectionListError,
  FlashcardCollectionListSkeleton,
  NoFlashcardCollectionResults,
} from "../components/flashcard-collection-list-states.tsx";
import { ProjectFilter, type ProjectFilterValue } from "../components/project-filter.tsx";
import { PracticeSetupDialog } from "../components/practice-setup-dialog.tsx";
import { getFlashcardCollectionErrorMessage } from "../flashcard-messages.ts";

type CollectionAction = "archive" | "delete" | "edit";
const parsePage = (value: string | null) => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

export const FlashcardCollectionListPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawQuery = searchParams.get("query")?.trim() ?? "";
  const parsedQuery = flashcardCollectionListQuerySchema.shape.query.safeParse(rawQuery);
  const query = parsedQuery.success ? parsedQuery.data : "";
  const status: FlashcardCollectionStatus =
    searchParams.get("status") === "archived" ? "archived" : "active";
  const parsedProject = flashcardCollectionProjectFilterSchema.safeParse(
    searchParams.get("project") ?? undefined,
  );
  const project = parsedProject.success ? parsedProject.data : undefined;
  const page = parsePage(searchParams.get("page"));
  const [searchValue, setSearchValue] = useState(query);
  const [createOpen, setCreateOpen] = useState(false);
  const [practiceCollectionId, setPracticeCollectionId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<{
    action: CollectionAction;
    collection: FlashcardCollectionSummary;
  } | null>(null);
  const input = flashcardCollectionListQuerySchema.parse({
    page,
    pageSize: FLASHCARD_COLLECTION_PAGE_SIZE,
    project,
    query,
    status,
  });
  const collections = useFlashcardCollections(input);
  const restore = useRestoreFlashcardCollection();
  const restoringIds = useRef(new Set<string>());

  const updateParams = (changes: Record<string, string | undefined>, resetPage = true) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (!value || (key === "status" && value === "active")) next.delete(key);
        else next.set(key, value);
      }
      if (resetPage) next.delete("page");
      return next;
    });
  };
  const setPage = (nextPage: number) =>
    updateParams({ page: nextPage <= 1 ? undefined : String(nextPage) }, false);
  const clearFilters = () => {
    setSearchValue("");
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("query");
      next.delete("project");
      next.delete("page");
      return next;
    });
  };

  useEffect(() => setSearchValue(query), [query]);
  useEffect(() => {
    const normalized = searchValue.trim();
    if (normalized === query) return;
    const timer = window.setTimeout(() => updateParams({ query: normalized || undefined }), 300);
    return () => window.clearTimeout(timer);
  }, [query, searchValue]);
  useEffect(() => {
    const totalPages = collections.data?.pagination.totalPages;
    if (totalPages && page > totalPages) setPage(totalPages);
  }, [collections.data?.pagination.totalPages, page]);

  const handleAction = async (
    action: "archive" | "delete" | "edit" | "restore",
    collection: FlashcardCollectionSummary,
  ) => {
    if (action !== "restore") {
      setActiveAction({ action, collection });
      return;
    }
    if (restoringIds.current.has(collection.id)) return;
    restoringIds.current.add(collection.id);
    try {
      await restore.mutateAsync(collection.id);
      toast.success("Coleção restaurada.");
    } catch (error) {
      toast.error(
        getFlashcardCollectionErrorMessage(error, "Não foi possível restaurar a coleção."),
      );
    } finally {
      restoringIds.current.delete(collection.id);
    }
  };

  const hasItems = Boolean(collections.data?.items.length);
  const hasFilters = Boolean(query || project);
  const isEmpty = collections.data?.pagination.totalItems === 0 && !hasFilters;
  const noResults = collections.data?.pagination.totalItems === 0 && hasFilters;

  return (
    <div className="flex flex-1 flex-col px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Estudo ativo
            </p>
            <h1 className="font-heading text-4xl font-medium tracking-tight sm:text-5xl">
              Flashcards
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Organize suas coleções e acompanhe o que já estudou e o que precisa revisar.
            </p>
          </div>
          <Button className="self-start sm:self-auto" onClick={() => setCreateOpen(true)}>
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            Nova coleção
          </Button>
        </div>

        <div className="my-8 grid gap-3 border-y py-3 lg:grid-cols-[minmax(15rem,1fr)_auto_auto] lg:items-center">
          <div className="relative min-w-0 lg:max-w-md">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Pesquisar coleções"
              className="h-9 pr-9 pl-9"
              maxLength={100}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Pesquisar coleções"
              type="text"
              value={searchValue}
            />
            {searchValue && (
              <Button
                aria-label="Limpar pesquisa"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => {
                  setSearchValue("");
                  updateParams({ query: undefined });
                }}
                size="icon-sm"
                variant="ghost"
              >
                <XIcon aria-hidden="true" />
              </Button>
            )}
          </div>
          <ProjectFilter
            onChange={(value: ProjectFilterValue) => updateParams({ project: value })}
            value={project}
          />
          <Tabs onValueChange={(value) => updateParams({ status: value })} value={status}>
            <TabsList aria-label="Estado das coleções" variant="line">
              <TabsTrigger value="active">Ativas</TabsTrigger>
              <TabsTrigger value="archived">Arquivadas</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {collections.isPending && <FlashcardCollectionListSkeleton />}
        {collections.isError && (
          <FlashcardCollectionListError onRetry={() => void collections.refetch()} />
        )}
        {isEmpty && (
          <EmptyFlashcardCollections
            archived={status === "archived"}
            onCreate={() => setCreateOpen(true)}
          />
        )}
        {noResults && <NoFlashcardCollectionResults onClear={clearFilters} />}
        {hasItems && collections.data && (
          <FlashcardCollectionList
            collections={collections.data.items}
            onAction={(action, collection) => void handleAction(action, collection)}
            onPractice={(collection) => setPracticeCollectionId(collection.id)}
            query={query}
          />
        )}
        {collections.data && (
          <PaginationControls
            label="Paginação de coleções"
            onPageChange={setPage}
            pagination={collections.data.pagination}
          />
        )}
      </div>

      <FlashcardCollectionDialog onOpenChange={setCreateOpen} open={createOpen} />
      {practiceCollectionId && (
        <PracticeSetupDialog
          collectionId={practiceCollectionId}
          onOpenChange={(open) => !open && setPracticeCollectionId(null)}
          open
        />
      )}
      {activeAction?.action === "edit" && (
        <FlashcardCollectionDialog
          collection={activeAction.collection}
          onOpenChange={(open) => !open && setActiveAction(null)}
          open
        />
      )}
      {activeAction?.action === "archive" && (
        <ArchiveFlashcardCollectionDialog
          collection={activeAction.collection}
          onOpenChange={(open) => !open && setActiveAction(null)}
          open
        />
      )}
      {activeAction?.action === "delete" && (
        <DeleteFlashcardCollectionDialog
          collection={activeAction.collection}
          onDeleted={() => {
            if (collections.data?.items.length === 1 && page > 1) setPage(page - 1);
            setActiveAction(null);
          }}
          onOpenChange={(open) => !open && setActiveAction(null)}
          open
        />
      )}
    </div>
  );
};

export default FlashcardCollectionListPage;
