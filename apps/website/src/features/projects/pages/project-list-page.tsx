import { PROJECT_PAGE_SIZE, type ProjectSummary } from "@lazuli/shared";
import { PlusIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useLocation, useSearchParams } from "react-router";

import { ContentPage } from "@/components/content-page.tsx";
import { SearchInput } from "@/components/search-input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { parsePositivePage } from "@/lib/pagination.ts";
import { usePaginationClamp } from "@/hooks/use-pagination-clamp.ts";
import { useDebouncedSearch } from "@/hooks/use-debounced-search.ts";
import { mergeSearchParams } from "@/lib/search-params.ts";
import { useProjects } from "../api/project-queries.ts";
import { ProjectCard } from "../components/project-card.tsx";
import {
  ChangeProjectCoverDialog,
  CreateProjectDialog,
  DeleteProjectDialog,
  RenameProjectDialog,
} from "../components/project-dialogs.tsx";
import {
  EmptyProjects,
  NoProjectResults,
  ProjectListError,
  ProjectListSkeleton,
} from "../components/project-list-states.tsx";
import { ProjectPagination } from "../components/project-pagination.tsx";
import { ProjectTable } from "../components/project-table.tsx";
import { ViewModeToggle, type ViewMode } from "@/components/view-mode-toggle.tsx";
import type { ProjectAction } from "../project-types.ts";

const getInitialView = (): ViewMode =>
  localStorage.getItem("lazuli-project-view") === "table" ? "table" : "cards";

export const ProjectListPage = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("query")?.trim() ?? "";
  const page = parsePositivePage(searchParams.get("page"));
  const [searchValue, setSearchValue] = useDebouncedSearch(query, (value) => {
    setSearchParams((current) => mergeSearchParams(current, { query: value || undefined }));
  });
  const [view, setView] = useState<ViewMode>(getInitialView);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<{
    action: ProjectAction;
    project: ProjectSummary;
  } | null>(null);
  const projects = useProjects({ page, pageSize: PROJECT_PAGE_SIZE, query });
  const listLocation = `${location.pathname}${location.search}`;

  const setPage = useCallback(
    (nextPage: number) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (nextPage <= 1) next.delete("page");
        else next.set("page", String(nextPage));
        return next;
      });
    },
    [setSearchParams],
  );

  const clearSearch = () => {
    setSearchValue("");
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("query");
      next.delete("page");
      return next;
    });
  };

  const changeView = (nextView: ViewMode) => {
    setView(nextView);
    localStorage.setItem("lazuli-project-view", nextView);
  };

  usePaginationClamp(page, projects.data?.pagination.totalPages, setPage);

  const openAction = (action: ProjectAction, project: ProjectSummary) =>
    setActiveAction({ action, project });

  const hasProjects = Boolean(projects.data?.items.length);
  const isEmptyLibrary = projects.data?.pagination.totalItems === 0 && !query;
  const hasNoResults = projects.data?.pagination.totalItems === 0 && Boolean(query);

  return (
    <ContentPage maxWidth="6xl">
      <h1 className="font-heading text-4xl font-medium tracking-tight sm:text-5xl">Projetos</h1>

      <div className="my-7 flex flex-wrap items-center gap-2">
        <SearchInput
          aria-label="Pesquisar projetos"
          className="h-9"
          containerClassName="min-w-56 flex-1"
          maxLength={100}
          onClear={clearSearch}
          onValueChange={setSearchValue}
          placeholder="Pesquisar projetos"
          value={searchValue}
        />
        <div className="ml-auto">
          <ViewModeToggle label="Visualização dos projetos" onChange={changeView} value={view} />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          Novo projeto
        </Button>
      </div>

      {projects.isPending && <ProjectListSkeleton view={view} />}
      {projects.isError && <ProjectListError onRetry={() => void projects.refetch()} />}
      {isEmptyLibrary && <EmptyProjects onCreate={() => setCreateOpen(true)} />}
      {hasNoResults && <NoProjectResults onClear={clearSearch} />}
      {hasProjects && view === "cards" && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {projects.data?.items.map((project) => (
            <ProjectCard
              key={project.id}
              listLocation={listLocation}
              onChangeCover={() => openAction("cover", project)}
              onDelete={() => openAction("delete", project)}
              onRename={() => openAction("rename", project)}
              project={project}
              query={query}
            />
          ))}
        </div>
      )}
      {hasProjects && view === "table" && projects.data && (
        <ProjectTable
          listLocation={listLocation}
          onAction={openAction}
          projects={projects.data.items}
          query={query}
        />
      )}
      {projects.data && (
        <ProjectPagination onPageChange={setPage} pagination={projects.data.pagination} />
      )}
      <CreateProjectDialog onOpenChange={setCreateOpen} open={createOpen} />
      {activeAction?.action === "rename" && (
        <RenameProjectDialog
          onOpenChange={(open) => !open && setActiveAction(null)}
          open
          project={activeAction.project}
        />
      )}
      {activeAction?.action === "cover" && (
        <ChangeProjectCoverDialog
          onOpenChange={(open) => !open && setActiveAction(null)}
          open
          project={activeAction.project}
        />
      )}
      {activeAction?.action === "delete" && (
        <DeleteProjectDialog
          onDeleted={() => {
            if (projects.data?.items.length === 1 && page > 1) setPage(page - 1);
            setActiveAction(null);
          }}
          onOpenChange={(open) => !open && setActiveAction(null)}
          open
          project={activeAction.project}
        />
      )}
    </ContentPage>
  );
};

export default ProjectListPage;
