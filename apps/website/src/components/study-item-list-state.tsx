import { PlusIcon, SearchXIcon } from "@/components/icons.tsx";
import type { ComponentType, ReactNode } from "react";

import { EmptyState, LoadError } from "@/components/empty-state.tsx";
import { Button } from "@/components/ui/button.tsx";

export const StudyItemListState = ({
  children,
  createLabel,
  emptyIcon: EmptyIcon,
  emptyTitle,
  error,
  loading,
  onCreate,
  onRetry,
  query,
  skeleton,
  totalItems,
  guidedElsewhere = false,
}: {
  children: ReactNode;
  createLabel?: string;
  emptyIcon: ComponentType<{ className?: string }>;
  emptyTitle: string;
  error: boolean;
  loading: boolean;
  onCreate?: () => void;
  onRetry: () => void;
  query: string;
  skeleton: ReactNode;
  totalItems?: number;
  /** The empty collection is guided in the work area: the index stays quiet instead of repeating it. */
  guidedElsewhere?: boolean;
}) => {
  if (loading) return skeleton;
  if (error)
    return (
      <LoadError
        minHeight="sm"
        onRetry={onRetry}
        surface="inline"
        title="Não foi possível carregar"
      />
    );
  if (totalItems === 0 && guidedElsewhere && !query) return null;
  if (totalItems === 0) {
    const Icon = query ? SearchXIcon : EmptyIcon;
    return (
      <EmptyState
        action={
          !query && onCreate && createLabel ? (
            <Button onClick={onCreate} size="sm">
              <PlusIcon /> {createLabel}
            </Button>
          ) : undefined
        }
        description={
          query ? "Tente outro termo ou limpe a pesquisa." : "Crie um material para começar."
        }
        icon={Icon}
        minHeight="sm"
        // Inside the index column: no card of its own, aligned with the list's side margins.
        surface="inline"
        title={query ? "Nenhum resultado" : emptyTitle}
      />
    );
  }
  return children;
};
