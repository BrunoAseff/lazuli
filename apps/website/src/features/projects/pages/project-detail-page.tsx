import { ResourceUnavailable } from "@/components/not-found-page.tsx";
import { BackLink } from "@/components/nav-link.tsx";
import { FilePlus2Icon, UploadIcon } from "@/components/icons.tsx";
import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { DocumentDomainIcon } from "@/components/domain-icons.ts";
import { EmptyState } from "@/components/empty-state.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { RecentDocuments } from "@/features/documents/components/recent-documents.tsx";
import { useDocumentImports } from "@/features/document-imports/document-import-context.ts";
import { useCreateProjectItem } from "@/features/documents/api/document-queries.ts";
import { documentLocation } from "@/features/documents/document-navigation.ts";
import { DOCUMENT_MESSAGES } from "@/features/documents/document-messages.ts";
import { useProject, useProjectDocuments } from "../api/project-queries.ts";
import { ProjectApiError } from "../api/project-api.ts";
import {
  ChangeProjectCoverDialog,
  DeleteProjectDialog,
  RenameProjectDialog,
} from "../components/project-dialogs.tsx";
import { ProjectActionsMenu } from "../components/project-actions-menu.tsx";
import { ProjectCover } from "../components/project-cover.tsx";
import { ViewModeToggle, type ViewMode } from "@/components/view-mode-toggle.tsx";
import type { ProjectAction } from "../project-types.ts";

export const ProjectDetailPage = () => {
  const { projectId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { openImportDialog } = useDocumentImports();
  const createItem = useCreateProjectItem(projectId);
  const [action, setAction] = useState<ProjectAction | null>(null);
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
  const createBlankDocument = async () => {
    try {
      const item = await createItem.mutateAsync({
        id: crypto.randomUUID(),
        type: "document",
        parentId: null,
        title: "Novo documento",
      });
      toast.success(DOCUMENT_MESSAGES.createDocumentSuccess);
      void navigate(documentLocation({ documentId: item.id, projectId }));
    } catch {
      toast.error(DOCUMENT_MESSAGES.createError);
    }
  };

  if (project.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 pt-7 pb-8 sm:px-8 lg:px-12 lg:pt-7 lg:pb-10">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="aspect-[3/1] w-full rounded-xl" />
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (project.isError || !project.data) {
    return (
      <ResourceUnavailable
        backLabel="Voltar aos projetos"
        backTo={backLocation}
        notFound={notFound}
        onRetry={() => void project.refetch()}
        title="Projeto não encontrado"
      />
    );
  }

  const currentProject = project.data;

  return (
    <div className="mr-1 flex h-full min-h-0 flex-col overflow-y-auto px-5 pt-5 pb-8 sm:px-8 sm:pt-7 lg:px-12 lg:pb-10 lazuli-thin-scrollbar">
      <div className="mx-auto w-full max-w-6xl">
        <BackLink className="project-home-back mb-4 sm:mb-6" to={backLocation}>
          Projetos
        </BackLink>

        {(currentProject.coverKey || currentProject.coverAssetId) && (
          <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card">
            <ProjectCover
              className="max-h-72 min-h-32 sm:min-h-44"
              coverKey={currentProject.coverKey}
              assetId={currentProject.coverAssetId}
            />
          </div>
        )}

        <div className="mt-5 flex items-start justify-between gap-4 sm:mt-7">
          <div className="min-w-0 space-y-2">
            <h1 className="page-title [overflow-wrap:anywhere]">{currentProject.title}</h1>
            <p className="text-sm text-muted-foreground">
              {currentProject.documentCount}{" "}
              {currentProject.documentCount === 1 ? "documento" : "documentos"}
            </p>
          </div>
          <ProjectActionsMenu
            onChangeCover={() => setAction("cover")}
            onDelete={() => setAction("delete")}
            onRename={() => setAction("rename")}
          />
        </div>

        <section className="mt-7 sm:mt-8" aria-labelledby="project-documents-title">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-sm leading-snug font-semibold" id="project-documents-title">
              Documentos recentes
            </h2>
            {Boolean(documents.data?.items.length) && !documents.isError && (
              <ViewModeToggle
                label="Visualização dos documentos recentes"
                onChange={changeDocumentView}
                value={documentView}
              />
            )}
          </div>

          {documents.isPending && (
            <div
              className="mt-5 grid gap-px overflow-hidden rounded-xl border border-border/50 bg-border/40"
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
            <div className="mt-5 rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar os documentos.
              </p>
              <Button className="mt-4" onClick={() => void documents.refetch()} variant="outline">
                Tentar novamente
              </Button>
            </div>
          )}

          {documents.data?.items.length === 0 && (
            <div className="mt-5">
              <EmptyState
                surface="inline"
                action={
                  <div className="flex flex-col justify-center gap-2 sm:flex-row">
                    <Button onClick={() => openImportDialog(projectId, null)} variant="outline">
                      <UploadIcon />
                      Importar documento
                    </Button>
                    <Button
                      disabled={createItem.isPending}
                      onClick={() => void createBlankDocument()}
                    >
                      <FilePlus2Icon />
                      Criar documento em branco
                    </Button>
                  </div>
                }
                description="Importe um material que você já possui ou comece uma página em branco."
                icon={DocumentDomainIcon}
                title="Nenhum documento ainda"
              />
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
