import { useEffect } from "react";

export const usePaginationClamp = (
  page: number,
  totalPages: number | undefined,
  setPage: (page: number) => void,
) => {
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [page, setPage, totalPages]);
};
