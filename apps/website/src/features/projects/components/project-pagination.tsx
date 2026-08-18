import type { Pagination } from "@lazuli/shared";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";

export const ProjectPagination = ({
  onPageChange,
  pagination,
}: {
  onPageChange: (page: number) => void;
  pagination: Pagination;
}) => {
  if (pagination.totalPages <= 1) return null;

  return (
    <nav
      aria-label="Paginação de projetos"
      className="mt-7 flex items-center justify-between gap-4"
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
