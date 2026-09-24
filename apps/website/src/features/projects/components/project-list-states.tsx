import { SearchXIcon, TriangleAlertIcon } from "lucide-react";

import { ProjectOpenIcon } from "@/components/domain-icons.ts";
import { EmptyState } from "@/components/empty-state.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import type { ViewMode } from "@/components/view-mode-toggle.tsx";

export const ProjectListSkeleton = ({ view }: { view: ViewMode }) => {
  if (view === "table") {
    return (
      <div
        aria-label="Carregando projetos"
        className="divide-y overflow-hidden rounded-xl border"
        role="status"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <div className="flex items-center gap-4 p-4" key={index}>
            <Skeleton className="h-10 w-[4.5rem]" />
            <Skeleton className="h-4 w-48 max-w-[45%]" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      aria-label="Carregando projetos"
      className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
      role="status"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div className="overflow-hidden rounded-xl border" key={index}>
          <Skeleton className="aspect-video w-full" />
          <div className="grid gap-3 p-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const EmptyProjects = ({ onCreate }: { onCreate: () => void }) => (
  <EmptyState
    action={<Button onClick={onCreate}>Novo projeto</Button>}
    description="Reúna documentos de uma disciplina, idioma ou assunto em um mesmo lugar."
    featuredIcon
    icon={ProjectOpenIcon}
    minHeight="lg"
    title="Crie seu primeiro projeto"
  />
);

export const NoProjectResults = ({ onClear }: { onClear: () => void }) => (
  <EmptyState
    action={
      <Button onClick={onClear} variant="outline">
        Limpar pesquisa
      </Button>
    }
    description="Tente outro termo ou limpe a pesquisa."
    icon={SearchXIcon}
    title="Nenhum projeto encontrado"
  />
);

export const ProjectListError = ({ onRetry }: { onRetry: () => void }) => (
  <EmptyState
    action={
      <Button onClick={onRetry} variant="outline">
        Tentar novamente
      </Button>
    }
    description="Confira sua conexão e tente novamente."
    icon={TriangleAlertIcon}
    iconClassName="text-destructive"
    title="Não foi possível carregar os projetos"
  />
);
