import { ArrowLeftIcon, FileTextIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";

import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { RecentDocuments } from "@/features/documents/components/recent-documents.tsx";
import { useProject, useProjectDocuments } from "../api/project-queries.ts";
import { ProjectApiError } from "../api/project-api.ts";
import {
  ChangeProjectCoverDialog,
  DeleteProjectDialog,
  RenameProjectDialog,
} from "../components/project-dialogs.tsx";
import { ProjectActionsMenu } from "../components/project-actions-menu.tsx";
import { ProjectCover } from "../components/project-cover.tsx";
import { ViewModeToggle, type ViewMode } from "../components/view-mode-toggle.tsx";

type DetailAction = "cover" | "delete" | "rename" | null;

export const ProjectDetailPage = () => {
  const { projectId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [action, setAction] = useState<DetailAction>(null);
  const [documentView, setDocumentView] = useState<ViewMode>(() =>
    localStorage.getItem("lazuli-document-view") === "table" ? "table" : "cards",
  );
  const project = useProject(projectId);
  const documents = useProjectDocuments(projectId, 1, 6);
  const state = location.state as { projectListLocation?: unknown } | null;
  const backLocation =
    typeof state?.projectListLocation === "string" ? state.projectListLocation : "/documents";
  const notFound = project.error instanceof ProjectApiError && project.error.status === 404;
  const changeDocumentView = (view: ViewMode) => {
    setDocumentView(view);
    localStorage.setItem("lazuli-document-view", view);
  };

  if (project.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 pt-7 pb-8 sm:px-8 lg:px-12 lg:pt-7 lg:pb-10">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="aspect-[3/1] w-full rounded-none" />
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-64 w-full rounded-none" />
      </div>
    );
  }

  if (project.isError || !project.data) {
    return (
      <div className="grid flex-1 place-items-center px-5 py-10 text-center">
        <div className="max-w-sm">
          <TriangleAlertIcon
            aria-hidden="true"
            className="mx-auto mb-4 size-8 text-muted-foreground"
          />
          <h1 className="font-heading text-3xl font-medium">
            {notFound ? "Projeto não encontrado" : "Não foi possível carregar o projeto"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {notFound
              ? "Ele pode ter sido excluído ou não pertencer à sua biblioteca."
              : "Confira sua conexão e tente novamente."}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button asChild variant="outline">
              <Link to={backLocation}>Voltar aos projetos</Link>
            </Button>
            {!notFound && <Button onClick={() => void project.refetch()}>Tentar novamente</Button>}
          </div>
        </div>
      </div>
    );
  }

  const currentProject = project.data;

  return (
    <div className="flex min-h-full flex-col px-5 pt-7 pb-8 sm:px-8 lg:px-12 lg:pt-7 lg:pb-10">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          to={backLocation}
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          Projetos
        </Link>

        <div className="relative overflow-hidden border bg-card">
          <ProjectCover className="max-h-72 min-h-44" coverKey={currentProject.coverKey} />
          <ProjectActionsMenu
            className="absolute top-3 right-3"
            onChangeCover={() => setAction("cover")}
            onDelete={() => setAction("delete")}
            onRename={() => setAction("rename")}
          />
        </div>

        <div className="mt-7 flex flex-col gap-2 border-b pb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Documentos / Projeto
          </p>
          <h1 className="font-heading text-4xl font-medium tracking-tight [overflow-wrap:anywhere] sm:text-5xl">
            {currentProject.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {currentProject.documentCount}{" "}
            {currentProject.documentCount === 1 ? "documento" : "documentos"}
          </p>
        </div>

        <section className="mt-8" aria-labelledby="project-documents-title">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-heading text-2xl font-medium" id="project-documents-title">
              Documentos recentes
            </h2>
            <ViewModeToggle
              label="Visualização dos documentos recentes"
              onChange={changeDocumentView}
              value={documentView}
            />
          </div>

          {documents.isPending && (
            <div
              className="mt-5 grid gap-px border bg-border"
              role="status"
              aria-label="Carregando documentos"
            >
              {Array.from({ length: 4 }, (_, index) => (
                <div className="flex items-center gap-3 bg-background p-4" key={index}>
                  <Skeleton className="size-5" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ))}
            </div>
          )}

          {documents.isError && (
            <div className="mt-5 border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar os documentos.
              </p>
              <Button className="mt-4" onClick={() => void documents.refetch()} variant="outline">
                Tentar novamente
              </Button>
            </div>
          )}

          {documents.data?.items.length === 0 && (
            <div className="mt-5 grid min-h-56 place-items-center border border-dashed bg-card/40 p-6 text-center">
              <div className="max-w-sm">
                <FileTextIcon
                  aria-hidden="true"
                  className="mx-auto mb-4 size-7 text-muted-foreground"
                />
                <h3 className="font-heading text-2xl font-medium">Nenhum documento ainda</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Os documentos deste projeto serão criados e organizados aqui na próxima etapa.
                </p>
              </div>
            </div>
          )}

          {documents.data && documents.data.items.length > 0 && (
            <RecentDocuments
              items={documents.data.items}
              projectId={projectId}
              view={documentView}
            />
          )}
        </section>
      </div>

      {action === "rename" && (
        <RenameProjectDialog
          onOpenChange={(open) => !open && setAction(null)}
          open
          project={currentProject}
        />
      )}
      {action === "cover" && (
        <ChangeProjectCoverDialog
          onOpenChange={(open) => !open && setAction(null)}
          open
          project={currentProject}
        />
      )}
      {action === "delete" && (
        <DeleteProjectDialog
          onDeleted={() => navigate(backLocation, { replace: true })}
          onOpenChange={(open) => !open && setAction(null)}
          open
          project={currentProject}
        />
      )}
    </div>
  );
};

export default ProjectDetailPage;
