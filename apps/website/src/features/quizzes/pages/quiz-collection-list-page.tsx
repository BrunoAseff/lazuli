import {
  QUIZ_COLLECTION_PAGE_SIZE,
  quizCollectionListQuerySchema,
  type QuizCollectionSummary,
} from "@lazuli/shared";
import { SquareCheckBig, PlusIcon } from "lucide-react";
import { useState } from "react";

import { PaginationControls } from "@/components/pagination-controls.tsx";
import { ContentPage } from "@/components/content-page.tsx";
import {
  EmptyStudyCollections,
  NoStudyCollectionResults,
  StudyCollectionListError,
  StudyCollectionListSkeleton,
} from "@/components/study-collection-list-states.tsx";
import { StudyCollectionToolbar } from "@/components/study-collection-toolbar.tsx";
import { Button } from "@/components/ui/button.tsx";
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
    <ContentPage>
      <h1 className="font-heading text-4xl font-normal tracking-tight sm:text-5xl">Quizzes</h1>

      <StudyCollectionToolbar
        action={
          <Button className="shrink-0" onClick={() => setCreateOpen(true)}>
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            <span className="hidden sm:inline">Nova coleção</span>
          </Button>
        }
        onClearSearch={() => {
          setSearchValue("");
          updateParams({ query: undefined });
        }}
        onProjectChange={(value) => updateParams({ project: value })}
        onSearchChange={setSearchValue}
        onStatusChange={(value) => updateParams({ status: value })}
        project={project}
        searchDisabled={isEmpty}
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
          description="Organize questões por disciplina, idioma ou assunto."
          icon={SquareCheckBig}
          onCreate={() => setCreateOpen(true)}
        />
      )}
      {noResults && <NoStudyCollectionResults onClear={clearFilters} />}
      {hasItems && collections.data && (
        <QuizCollectionList
          collections={collections.data.items}
          onAction={(action, collection) => void handleAction(action, collection)}
          query={query}
        />
      )}
      {collections.data && (
        <PaginationControls
          label="Paginação de coleções de quizzes"
          onPageChange={setPage}
          pagination={collections.data.pagination}
        />
      )}
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
    </ContentPage>
  );
};

export default QuizCollectionListPage;
