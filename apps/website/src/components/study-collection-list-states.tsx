import { type AppIcon } from "@/components/icons.tsx";
import { ArchiveIcon, SearchXIcon } from "@/components/icons.tsx";

import { EmptyState, LoadError } from "@/components/empty-state.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

/** The collection cards' own layout (study-collection-card.css): mark and title, actions, strip. */
export const StudyCollectionListSkeleton = () => (
  <div aria-label="Carregando coleções" className="space-y-2" role="status">
    {Array.from({ length: 5 }, (_, index) => (
      <div className="collection-card" key={index}>
        <div className="collection-card-identity flex items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-[var(--radius)]" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="collection-card-actions">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="size-8" />
        </div>
        <div className="collection-card-state">
          <Skeleton className="h-1.5 w-full max-w-md rounded-full" />
        </div>
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
  icon: AppIcon;
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
  <LoadError onRetry={onRetry} title="Não foi possível carregar as coleções" />
);
