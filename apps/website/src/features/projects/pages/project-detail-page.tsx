import { ResourceUnavailable } from "@/components/not-found-page.tsx";
import { BackLink } from "@/components/nav-link.tsx";
import { FilePlus2Icon, UploadIcon } from "@/components/icons.tsx";
import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { CreateMaterialsButton } from "@/features/ai/components/ai-collection-generation-dialog.tsx";
import { DocumentDomainIcon } from "@/components/domain-icons.ts";
import { EmptyState } from "@/components/empty-state.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
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
import {
  ProjectStudy,
  projectStudyMeta,
  useProjectCollectionCount,
} from "../components/project-study.tsx";
import type { ProjectAction } from "../project-types.ts";

export const ProjectDetailPage = () => {
  const { projectId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { openImportDialog } = useDocumentImports();
  const createItem = useCreateProjectItem(projectId);
  const [action, setAction] = useState<ProjectAction | null>(null);
  const project = useProject(projectId);
  const documents = useProjectDocuments(projectId, 1, 8);
  const collectionCount = useProjectCollectionCount(projectId);
  const state = location.state as { projectListLocation?: unknown } | null;
  const backLocation =
    typeof state?.projectListLocation === "string" ? state.projectListLocation : "/documents";
  const notFound = project.error instanceof ProjectApiError && project.error.status === 404;
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
              {projectStudyMeta(currentProject.documentCount, collectionCount)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CreateMaterialsButton label="Criar materiais" projectId={projectId} />
            <ProjectActionsMenu
              onChangeCover={() => setAction("cover")}
              onDelete={() => setAction("delete")}
              onRename={() => setAction("rename")}
            />
          </div>
        </div>

        <div className="mt-7 sm:mt-8">
          {documents.isPending && (
            <div aria-label="Carregando o projeto" className="grid gap-4" role="status">
              <Skeleton className="h-40 w-full rounded-[var(--radius-panel)]" />
              <Skeleton className="h-32 w-full rounded-[var(--radius-panel)]" />
            </div>
          )}

          {documents.isError && (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar os documentos.
              </p>
              <Button className="mt-4" onClick={() => void documents.refetch()} variant="outline">
                Tentar novamente
              </Button>
            </div>
          )}

          {documents.data && (
            <ProjectStudy
              documents={documents.data.items}
              emptyDocuments={
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
              }
              projectId={projectId}
            />
          )}
        </div>
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
