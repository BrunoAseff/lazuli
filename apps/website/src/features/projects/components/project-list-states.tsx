import { SearchXIcon } from "@/components/icons.tsx";

import { ProjectOpenIcon } from "@/components/domain-icons.ts";
import { EmptyState, LoadError } from "@/components/empty-state.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import type { ViewMode } from "@/components/view-mode-toggle.tsx";

export const ProjectListSkeleton = ({ view }: { view: ViewMode }) => {
  if (view === "table") {
    return (
      // The table's rows: cover, title, documents, date and the actions column.
      <div aria-label="Carregando projetos" className="surface-panel overflow-hidden" role="status">
        <div className="h-10" />
        {Array.from({ length: 6 }, (_, index) => (
          <div className="flex items-center gap-3 px-4 py-3" key={index}>
            <Skeleton className="hidden h-10 w-[4.5rem] shrink-0 rounded-[var(--radius)] sm:block" />
            <Skeleton className="h-4 w-48 max-w-[45%]" />
            <Skeleton className="ml-auto hidden h-4 w-20 sm:block" />
            <Skeleton className="hidden h-4 w-28 md:block" />
            <Skeleton className="size-8" />
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
        // The card: cover, title, then documents and date on one line.
        <div
          className="overflow-hidden rounded-[var(--radius-panel)] bg-card ring-1 ring-border/50"
          key={index}
        >
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="grid gap-3 p-4">
            <Skeleton className="h-5 w-2/3" />
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-16" />
            </div>
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
  <LoadError onRetry={onRetry} title="Não foi possível carregar os projetos" />
);
