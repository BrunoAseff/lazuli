import {
  FLASHCARD_COLLECTION_PAGE_SIZE,
  flashcardCollectionListQuerySchema,
  type FlashcardCollectionSummary,
} from "@lazuli/shared";
import { Layers3Icon, PlusIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PaginationControls } from "@/components/pagination-controls.tsx";
import {
  EmptyStudyCollections,
  NoStudyCollectionResults,
  StudyCollectionListError,
  StudyCollectionListSkeleton,
} from "@/components/study-collection-list-states.tsx";
import { StudyCollectionToolbar } from "@/components/study-collection-toolbar.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useStudyCollectionListState } from "@/hooks/use-study-collection-list-state.ts";
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
import { PracticeSetupDialog } from "../components/practice-setup-dialog.tsx";
import { getFlashcardCollectionErrorMessage } from "../flashcard-messages.ts";

type CollectionAction = "archive" | "delete" | "edit";

export const FlashcardCollectionListPage = () => {
  const {
    clearFilters,
    page,
    project,
    query,
    searchValue,
    setPage,
    setSearchValue,
    status,
    updateParams,
  } = useStudyCollectionListState();
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

        <StudyCollectionToolbar
          onClearSearch={() => {
            setSearchValue("");
            updateParams({ query: undefined });
          }}
          onProjectChange={(value) => updateParams({ project: value })}
          onSearchChange={setSearchValue}
          onStatusChange={(value) => updateParams({ status: value })}
          project={project}
          searchValue={searchValue}
          status={status}
        />

        {collections.isPending && <StudyCollectionListSkeleton />}
        {collections.isError && (
          <StudyCollectionListError onRetry={() => void collections.refetch()} />
        )}
        {isEmpty && (
          <EmptyStudyCollections
            archived={status === "archived"}
            description="Organize seus flashcards por disciplina, idioma ou assunto."
            icon={Layers3Icon}
            onCreate={() => setCreateOpen(true)}
          />
        )}
        {noResults && <NoStudyCollectionResults onClear={clearFilters} />}
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
