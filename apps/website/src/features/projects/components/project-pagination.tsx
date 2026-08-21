import type { Pagination } from "@lazuli/shared";
import { PaginationControls } from "@/components/pagination-controls.tsx";

export const ProjectPagination = ({
  onPageChange,
  pagination,
}: {
  onPageChange: (page: number) => void;
  pagination: Pagination;
}) => {
  return (
    <PaginationControls
      label="Paginação de projetos"
      onPageChange={onPageChange}
      pagination={pagination}
    />
  );
};
