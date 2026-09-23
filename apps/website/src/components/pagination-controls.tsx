import type { Pagination } from "@lazuli/shared";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";

export const PaginationControls = ({
  label,
  className,
  onPageChange,
  pagination,
}: {
  label: string;
  className?: string;
  onPageChange: (page: number) => void;
  pagination: Pagination;
}) => {
  if (pagination.totalPages <= 1) return null;
  return (
    <nav
      aria-label={label}
      className={cn("mt-7 flex items-center justify-between gap-4", className)}
    >
      <Button
        disabled={pagination.page <= 1}
        onClick={() => onPageChange(pagination.page - 1)}
        variant="outline"
      >
        <ChevronLeftIcon aria-hidden="true" data-icon="inline-start" />
        Anterior
      </Button>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        Página <strong className="font-medium text-foreground">{pagination.page}</strong> de{" "}
        {pagination.totalPages}
      </p>
      <Button
        disabled={pagination.page >= pagination.totalPages}
        onClick={() => onPageChange(pagination.page + 1)}
        variant="outline"
      >
        Próxima
        <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
      </Button>
    </nav>
  );
};
