import { FolderOpenIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export const ProjectListSkeleton = ({ view }: { view: "cards" | "table" }) => {
  if (view === "table") {
    return (
      <div aria-label="Carregando projetos" className="divide-y border" role="status">
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
        <div className="overflow-hidden border" key={index}>
          <Skeleton className="aspect-video w-full rounded-none" />
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
  <section className="grid min-h-72 place-items-center border border-dashed bg-card/40 px-5 text-center">
    <div className="max-w-sm">
      <span className="mx-auto mb-4 flex size-11 items-center justify-center border bg-background text-primary">
        <FolderOpenIcon aria-hidden="true" className="size-5" />
      </span>
      <h2 className="font-heading text-2xl font-medium">Crie seu primeiro projeto</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Reúna documentos de uma disciplina, idioma ou assunto em um mesmo lugar.
      </p>
      <Button className="mt-5" onClick={onCreate}>
        Novo projeto
      </Button>
    </div>
  </section>
);

export const NoProjectResults = ({ onClear }: { onClear: () => void }) => (
  <section className="grid min-h-64 place-items-center border border-dashed bg-card/40 px-5 text-center">
    <div className="max-w-sm">
      <SearchXIcon aria-hidden="true" className="mx-auto mb-4 size-7 text-muted-foreground" />
      <h2 className="font-heading text-2xl font-medium">Nenhum projeto encontrado</h2>
      <p className="mt-2 text-sm text-muted-foreground">Tente outro termo ou limpe a pesquisa.</p>
      <Button className="mt-5" onClick={onClear} variant="outline">
        Limpar pesquisa
      </Button>
    </div>
  </section>
);

export const ProjectListError = ({ onRetry }: { onRetry: () => void }) => (
  <section className="grid min-h-64 place-items-center border border-dashed bg-card/40 px-5 text-center">
    <div className="max-w-sm">
      <TriangleAlertIcon aria-hidden="true" className="mx-auto mb-4 size-7 text-destructive" />
      <h2 className="font-heading text-2xl font-medium">Não foi possível carregar os projetos</h2>
      <p className="mt-2 text-sm text-muted-foreground">Confira sua conexão e tente novamente.</p>
      <Button className="mt-5" onClick={onRetry} variant="outline">
        Tentar novamente
      </Button>
    </div>
  </section>
);
