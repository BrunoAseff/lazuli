import { PlusIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { EmptyState } from "@/components/empty-state.tsx";
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
}) => {
  if (loading) return skeleton;
  if (error)
    return (
      <EmptyState
        action={
          <Button onClick={onRetry} size="sm" variant="outline">
            Tentar novamente
          </Button>
        }
        description="Confira sua conexão e tente novamente."
        icon={TriangleAlertIcon}
        iconClassName="text-destructive"
        minHeight="sm"
        title="Não foi possível carregar"
      />
    );
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
        title={query ? "Nenhum resultado" : emptyTitle}
      />
    );
  }
  return children;
};
