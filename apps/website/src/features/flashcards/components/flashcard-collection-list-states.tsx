import { ArchiveIcon, Layers3Icon, SearchXIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export const FlashcardCollectionListSkeleton = () => (
  <div aria-label="Carregando coleções" className="divide-y border-y" role="status">
    {Array.from({ length: 5 }, (_, index) => (
      <div className="grid gap-5 py-5 sm:px-3 lg:grid-cols-3" key={index}>
        <Skeleton className="h-6 w-52 max-w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
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
  icon: typeof Layers3Icon;
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

export const EmptyFlashcardCollections = ({
  archived,
  onCreate,
}: {
  archived: boolean;
  onCreate: () => void;
}) => (
  <State
    icon={archived ? ArchiveIcon : Layers3Icon}
    title={archived ? "Nenhuma coleção arquivada" : "Crie sua primeira coleção"}
  >
    <p className="mt-2 text-sm leading-6 text-muted-foreground">
      {archived
        ? "Coleções arquivadas aparecerão aqui."
        : "Organize seus flashcards por disciplina, idioma ou assunto."}
    </p>
    {!archived && (
      <Button className="mt-5" onClick={onCreate}>
        Nova coleção
      </Button>
    )}
  </State>
);

export const NoFlashcardCollectionResults = ({ onClear }: { onClear: () => void }) => (
  <State icon={SearchXIcon} title="Nenhuma coleção encontrada">
    <p className="mt-2 text-sm text-muted-foreground">Tente outro termo ou limpe os filtros.</p>
    <Button className="mt-5" onClick={onClear} variant="outline">
      Limpar filtros
    </Button>
  </State>
);

export const FlashcardCollectionListError = ({ onRetry }: { onRetry: () => void }) => (
  <State icon={TriangleAlertIcon} title="Não foi possível carregar as coleções">
    <p className="mt-2 text-sm text-muted-foreground">Confira sua conexão e tente novamente.</p>
    <Button className="mt-5" onClick={onRetry} variant="outline">
      Tentar novamente
    </Button>
  </State>
);
