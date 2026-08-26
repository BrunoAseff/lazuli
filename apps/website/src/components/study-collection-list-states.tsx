import type { LucideIcon } from "lucide-react";
import { ArchiveIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export const StudyCollectionListSkeleton = () => (
  <div aria-label="Carregando coleções" className="divide-y border-y" role="status">
    {Array.from({ length: 5 }, (_, index) => (
      <div
        className="grid gap-5 py-5 sm:px-3 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(9rem,0.7fr))_auto]"
        key={index}
      >
        <Skeleton className="h-10 w-52 max-w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="size-8" />
      </div>
    ))}
  </div>
);

const State = ({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: LucideIcon;
  title: string;
}) => (
  <section className="grid min-h-64 place-items-center border border-dashed bg-card/40 px-5 text-center">
    <div className="max-w-sm">
      <Icon aria-hidden="true" className="mx-auto mb-4 size-7 text-muted-foreground" />
      <h2 className="font-heading text-2xl font-medium">{title}</h2>
      {children}
    </div>
  </section>
);

export const EmptyStudyCollections = ({
  archived,
  description,
  icon: Icon,
  onCreate,
}: {
  archived: boolean;
  description: string;
  icon: LucideIcon;
  onCreate: () => void;
}) => (
  <State
    icon={archived ? ArchiveIcon : Icon}
    title={archived ? "Nenhuma coleção arquivada" : "Crie sua primeira coleção"}
  >
    <p className="mt-2 text-sm leading-6 text-muted-foreground">
      {archived ? "Coleções arquivadas aparecerão aqui." : description}
    </p>
    {!archived && (
      <Button className="mt-5" onClick={onCreate}>
        Nova coleção
      </Button>
    )}
  </State>
);

export const NoStudyCollectionResults = ({ onClear }: { onClear: () => void }) => (
  <State icon={SearchXIcon} title="Nenhuma coleção encontrada">
    <p className="mt-2 text-sm text-muted-foreground">Tente outro termo ou limpe os filtros.</p>
    <Button className="mt-5" onClick={onClear} variant="outline">
      Limpar filtros
    </Button>
  </State>
);

export const StudyCollectionListError = ({ onRetry }: { onRetry: () => void }) => (
  <State icon={TriangleAlertIcon} title="Não foi possível carregar as coleções">
    <p className="mt-2 text-sm text-muted-foreground">Confira sua conexão e tente novamente.</p>
    <Button className="mt-5" onClick={onRetry} variant="outline">
      Tentar novamente
    </Button>
  </State>
);
