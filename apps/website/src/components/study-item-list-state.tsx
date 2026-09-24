import type { LucideIcon } from "lucide-react";
import { PlusIcon, SearchXIcon } from "lucide-react";
import type { ReactNode } from "react";

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
  emptyIcon: LucideIcon;
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
      <div className="p-5 text-center text-sm">
        <p>Não foi possível carregar.</p>
        <Button className="mt-3" onClick={onRetry} size="sm" variant="outline">
          Tentar novamente
        </Button>
      </div>
    );
  if (totalItems === 0) {
    const Icon = query ? SearchXIcon : EmptyIcon;
    return (
      <div className="px-3 py-10 text-center">
        <Icon className="mx-auto mb-3 size-6 text-muted-foreground" />
        <p className="font-heading text-lg">{query ? "Nenhum resultado" : emptyTitle}</p>
        {!query && onCreate && createLabel && (
          <Button className="mt-4" onClick={onCreate} size="sm">
            <PlusIcon /> {createLabel}
          </Button>
        )}
      </div>
    );
  }
  return children;
};
