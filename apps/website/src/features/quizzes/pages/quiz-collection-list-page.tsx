import {
  QUIZ_COLLECTION_PAGE_SIZE,
  quizCollectionListQuerySchema,
  type QuizCollectionSummary,
} from "@lazuli/shared";
import { SquareCheckBig } from "lucide-react";
import { useState } from "react";

import { StudyCollectionListPage } from "@/components/study-collection-list-page.tsx";
import { useStudyCollectionListState } from "@/hooks/use-study-collection-list-state.ts";
import { usePaginationClamp } from "@/hooks/use-pagination-clamp.ts";
import { useStudyCollectionActions } from "@/hooks/use-study-collection-actions.ts";
import { useQuizCollections, useRestoreQuizCollection } from "../api/quiz-collection-queries.ts";
import {
  ArchiveQuizCollectionDialog,
  DeleteQuizCollectionDialog,
  QuizCollectionDialog,
} from "../components/quiz-collection-dialogs.tsx";
import { QuizCollectionList } from "../components/quiz-collection-list.tsx";
import { getQuizCollectionErrorMessage } from "../quiz-messages.ts";

export const QuizCollectionListPage = () => {
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
  const input = quizCollectionListQuerySchema.parse({
    page,
    pageSize: QUIZ_COLLECTION_PAGE_SIZE,
    project,
    query,
    status,
  });
  const collections = useQuizCollections(input);
  const restore = useRestoreQuizCollection();
  const { activeAction, handleAction, setActiveAction } =
    useStudyCollectionActions<QuizCollectionSummary>({
      getRestoreErrorMessage: (error) =>
        getQuizCollectionErrorMessage(error, "Não foi possível restaurar a coleção."),
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
        emptyDescription="Organize questões por disciplina, idioma ou assunto."
        emptyIcon={SquareCheckBig}
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
        paginationLabel="Paginação de coleções de quizzes"
        project={project}
        searchDisabled={isEmpty}
        searchValue={searchValue}
        status={status}
        title="Quizzes"
      >
        {hasItems && collections.data && (
          <QuizCollectionList
            collections={collections.data.items}
            onAction={(action, collection) => void handleAction(action, collection)}
            query={query}
          />
        )}
      </StudyCollectionListPage>
      <QuizCollectionDialog onOpenChange={setCreateOpen} open={createOpen} />
      {activeAction?.action === "edit" && (
        <QuizCollectionDialog
          collection={activeAction.collection}
          onOpenChange={(open) => !open && setActiveAction(null)}
          open
        />
      )}
      {activeAction?.action === "archive" && (
        <ArchiveQuizCollectionDialog
          collection={activeAction.collection}
          onOpenChange={(open) => !open && setActiveAction(null)}
          open
        />
      )}
      {activeAction?.action === "delete" && (
        <DeleteQuizCollectionDialog
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

export default QuizCollectionListPage;
