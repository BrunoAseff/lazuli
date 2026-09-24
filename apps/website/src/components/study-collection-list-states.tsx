import type { LucideIcon } from "lucide-react";
import { ArchiveIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state.tsx";
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
  <EmptyState
    action={!archived && <Button onClick={onCreate}>Nova coleção</Button>}
    description={archived ? "Coleções arquivadas aparecerão aqui." : description}
    icon={archived ? ArchiveIcon : Icon}
    title={archived ? "Nenhuma coleção arquivada" : "Crie sua primeira coleção"}
  />
);

export const NoStudyCollectionResults = ({ onClear }: { onClear: () => void }) => (
  <EmptyState
    action={
      <Button onClick={onClear} variant="outline">
        Limpar filtros
      </Button>
    }
    description="Tente outro termo ou limpe os filtros."
    icon={SearchXIcon}
    title="Nenhuma coleção encontrada"
  />
);

export const StudyCollectionListError = ({ onRetry }: { onRetry: () => void }) => (
  <EmptyState
    action={
      <Button onClick={onRetry} variant="outline">
        Tentar novamente
      </Button>
    }
    description="Confira sua conexão e tente novamente."
    icon={TriangleAlertIcon}
    title="Não foi possível carregar as coleções"
  />
);
