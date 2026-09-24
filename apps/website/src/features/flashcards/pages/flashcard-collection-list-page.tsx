import {
  FLASHCARD_COLLECTION_PAGE_SIZE,
  flashcardCollectionListQuerySchema,
  type FlashcardCollectionSummary,
} from "@lazuli/shared";
import { Layers3Icon } from "lucide-react";
import { useState } from "react";

import { StudyCollectionListPage } from "@/components/study-collection-list-page.tsx";
import { useStudyCollectionListState } from "@/hooks/use-study-collection-list-state.ts";
import { usePaginationClamp } from "@/hooks/use-pagination-clamp.ts";
import { useStudyCollectionActions } from "@/hooks/use-study-collection-actions.ts";
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
  const input = flashcardCollectionListQuerySchema.parse({
    page,
    pageSize: FLASHCARD_COLLECTION_PAGE_SIZE,
    project,
    query,
    status,
  });
  const collections = useFlashcardCollections(input);
  const restore = useRestoreFlashcardCollection();
  const { activeAction, handleAction, setActiveAction } =
    useStudyCollectionActions<FlashcardCollectionSummary>({
      getRestoreErrorMessage: (error) =>
        getFlashcardCollectionErrorMessage(error, "Não foi possível restaurar a coleção."),
      restore: (collectionId) => restore.mutateAsync(collectionId),
    });
  usePaginationClamp(page, collections.data?.pagination.totalPages, setPage);

  const hasItems = Boolean(collections.data?.items.length);
  const hasFilters = Boolean(query || project);
  const isEmpty = collections.data?.pagination.totalItems === 0 && !hasFilters;
  const noResults = collections.data?.pagination.totalItems === 0 && hasFilters;

  return (
    <>
      <StudyCollectionListPage
        emptyDescription="Organize seus flashcards por disciplina, idioma ou assunto."
        emptyIcon={Layers3Icon}
        error={collections.isError}
        loading={collections.isPending}
        noResults={noResults}
        onClearFilters={clearFilters}
        onClearSearch={() => {
          setSearchValue("");
          updateParams({ query: undefined });
        }}
        onCreate={() => setCreateOpen(true)}
        onPageChange={setPage}
        onProjectChange={(value) => updateParams({ project: value })}
        onRetry={() => void collections.refetch()}
        onSearchChange={setSearchValue}
        onStatusChange={(value) => updateParams({ status: value })}
        pagination={collections.data?.pagination}
        paginationLabel="Paginação de coleções"
        project={project}
        searchDisabled={isEmpty}
        searchValue={searchValue}
        status={status}
        title="Flashcards"
      >
        {hasItems && collections.data && (
          <FlashcardCollectionList
            collections={collections.data.items}
            onAction={(action, collection) => void handleAction(action, collection)}
            onPractice={(collection) => setPracticeCollectionId(collection.id)}
            query={query}
          />
        )}
      </StudyCollectionListPage>
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
    </>
  );
};

export default FlashcardCollectionListPage;
