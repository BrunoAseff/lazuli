import type { Pagination, StudyCollectionStatus } from "@lazuli/shared";
import { PlusIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { ContentPage } from "@/components/content-page.tsx";
import { PaginationControls } from "@/components/pagination-controls.tsx";
import type { ProjectFilterValue } from "@/components/project-filter.tsx";
import {
  EmptyStudyCollections,
  NoStudyCollectionResults,
  StudyCollectionListError,
  StudyCollectionListSkeleton,
} from "@/components/study-collection-list-states.tsx";
import { StudyCollectionToolbar } from "@/components/study-collection-toolbar.tsx";
import { Button } from "@/components/ui/button.tsx";

export const StudyCollectionListPage = ({
  children,
  emptyDescription,
  emptyIcon,
  error,
  loading,
  noResults,
  onClearFilters,
  onClearSearch,
  onCreate,
  onPageChange,
  onProjectChange,
  onRetry,
  onSearchChange,
  onStatusChange,
  pagination,
  paginationLabel,
  project,
  searchDisabled,
  searchValue,
  status,
  title,
}: {
  children?: ReactNode;
  emptyDescription: string;
  emptyIcon: LucideIcon;
  error: boolean;
  loading: boolean;
  noResults: boolean;
  onClearFilters: () => void;
  onClearSearch: () => void;
  onCreate: () => void;
  onPageChange: (page: number) => void;
  onProjectChange: (value: ProjectFilterValue) => void;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StudyCollectionStatus) => void;
  pagination?: Pagination;
  paginationLabel: string;
  project: ProjectFilterValue;
  searchDisabled: boolean;
  searchValue: string;
  status: StudyCollectionStatus;
  title: string;
}) => (
  <ContentPage>
    <div className="flex items-center justify-between gap-4">
      <h1 className="page-title">{title}</h1>
      <Button aria-label="Nova coleção" className="shrink-0" onClick={onCreate}>
        <PlusIcon aria-hidden="true" data-icon="inline-start" />
        <span className="hidden sm:inline">Nova coleção</span>
      </Button>
    </div>
    <StudyCollectionToolbar
      onClearSearch={onClearSearch}
      onProjectChange={onProjectChange}
      onSearchChange={onSearchChange}
      onStatusChange={onStatusChange}
      project={project}
      searchDisabled={searchDisabled}
      searchValue={searchValue}
      status={status}
    />
    {loading && <StudyCollectionListSkeleton />}
    {error && <StudyCollectionListError onRetry={onRetry} />}
    {searchDisabled && (
      <EmptyStudyCollections
        archived={status === "archived"}
        description={emptyDescription}
        icon={emptyIcon}
        onCreate={onCreate}
      />
    )}
    {noResults && <NoStudyCollectionResults onClear={onClearFilters} />}
    {children}
    {pagination && (
      <PaginationControls
        label={paginationLabel}
        onPageChange={onPageChange}
        pagination={pagination}
      />
    )}
  </ContentPage>
);
