import { PROJECT_PAGE_SIZE, type ProjectSummary } from "@lazuli/shared";
import { PlusIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router";

import { ContentPage } from "@/components/content-page.tsx";
import { SearchInput } from "@/components/search-input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { parsePositivePage } from "@/lib/pagination.ts";
import { usePaginationClamp } from "@/hooks/use-pagination-clamp.ts";
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
import { ViewModeToggle, type ViewMode } from "../components/view-mode-toggle.tsx";

type ProjectAction = "cover" | "delete" | "rename";

const getInitialView = (): ViewMode =>
  localStorage.getItem("lazuli-project-view") === "table" ? "table" : "cards";

export const ProjectListPage = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("query")?.trim() ?? "";
  const page = parsePositivePage(searchParams.get("page"));
  const [searchValue, setSearchValue] = useState(query);
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

  useEffect(() => setSearchValue(query), [query]);

  useEffect(() => {
    const normalized = searchValue.trim();
    if (normalized === query) return;

    const timeout = window.setTimeout(() => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (normalized) next.set("query", normalized);
        else next.delete("query");
        next.delete("page");
        return next;
      });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query, searchValue, setSearchParams]);

  usePaginationClamp(page, projects.data?.pagination.totalPages, setPage);

  const openAction = (action: ProjectAction, project: ProjectSummary) =>
    setActiveAction({ action, project });

  const hasProjects = Boolean(projects.data?.items.length);
  const isEmptyLibrary = projects.data?.pagination.totalItems === 0 && !query;
  const hasNoResults = projects.data?.pagination.totalItems === 0 && Boolean(query);

  return (
    <ContentPage maxWidth="6xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Biblioteca pessoal
          </p>
          <h1 className="font-heading text-4xl font-medium tracking-tight sm:text-5xl">Projetos</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Organize documentos relacionados por disciplina, idioma ou assunto.
          </p>
        </div>
        <Button className="self-start sm:self-auto" onClick={() => setCreateOpen(true)}>
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          Novo projeto
        </Button>
      </div>

      <div className="my-8 flex items-center gap-2 border-y py-3">
        <SearchInput
          aria-label="Pesquisar projetos"
          className="h-9"
          containerClassName="flex-1 sm:max-w-md"
          maxLength={100}
          onClear={clearSearch}
          onValueChange={setSearchValue}
          placeholder="Pesquisar projetos"
          value={searchValue}
        />
        <div className="ml-auto">
          <ViewModeToggle label="Visualização dos projetos" onChange={changeView} value={view} />
        </div>
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
