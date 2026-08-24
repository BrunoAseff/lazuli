import { PROJECT_PAGE_SIZE, type ProjectSummary } from "@lazuli/shared";
import { PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router";

import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
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

const parsePage = (value: string | null) => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

export const ProjectListPage = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("query")?.trim() ?? "";
  const page = parsePage(searchParams.get("page"));
  const [searchValue, setSearchValue] = useState(query);
  const [view, setView] = useState<ViewMode>(getInitialView);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<{
    action: ProjectAction;
    project: ProjectSummary;
  } | null>(null);
  const projects = useProjects({ page, pageSize: PROJECT_PAGE_SIZE, query });
  const listLocation = `${location.pathname}${location.search}`;

  const setPage = (nextPage: number) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextPage <= 1) next.delete("page");
      else next.set("page", String(nextPage));
      return next;
    });
  };

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

  useEffect(() => {
    const totalPages = projects.data?.pagination.totalPages;
    if (totalPages && page > totalPages) setPage(totalPages);
  }, [page, projects.data?.pagination.totalPages]);

  const openAction = (action: ProjectAction, project: ProjectSummary) =>
    setActiveAction({ action, project });

  const hasProjects = Boolean(projects.data?.items.length);
  const isEmptyLibrary = projects.data?.pagination.totalItems === 0 && !query;
  const hasNoResults = projects.data?.pagination.totalItems === 0 && Boolean(query);

  return (
    <div className="flex flex-1 flex-col px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Biblioteca pessoal
            </p>
            <h1 className="font-heading text-4xl font-medium tracking-tight sm:text-5xl">
              Projetos
            </h1>
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
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Pesquisar projetos"
              className="h-9 pr-9 pl-9"
              maxLength={100}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Pesquisar projetos"
              type="text"
              value={searchValue}
            />
            {searchValue && (
              <Button
                aria-label="Limpar pesquisa"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={clearSearch}
                size="icon-sm"
                variant="ghost"
              >
                <XIcon aria-hidden="true" />
              </Button>
            )}
          </div>
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
      </div>

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
    </div>
  );
};

export default ProjectListPage;
