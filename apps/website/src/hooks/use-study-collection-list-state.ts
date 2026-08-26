import {
  studyCollectionListQueryShape,
  studyCollectionProjectFilterSchema,
  type StudyCollectionStatus,
} from "@lazuli/shared";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";

const parsePage = (value: string | null) => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

export const useStudyCollectionListState = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawQuery = searchParams.get("query")?.trim() ?? "";
  const parsedQuery = studyCollectionListQueryShape.query.safeParse(rawQuery);
  const query = parsedQuery.success ? parsedQuery.data : "";
  const status: StudyCollectionStatus =
    searchParams.get("status") === "archived" ? "archived" : "active";
  const parsedProject = studyCollectionProjectFilterSchema.safeParse(
    searchParams.get("project") ?? undefined,
  );
  const project = parsedProject.success ? parsedProject.data : undefined;
  const page = parsePage(searchParams.get("page"));
  const [searchValue, setSearchValue] = useState(query);

  const updateParams = useCallback(
    (changes: Record<string, string | undefined>, resetPage = true) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (!value || (key === "status" && value === "active")) next.delete(key);
          else next.set(key, value);
        }
        if (resetPage) next.delete("page");
        return next;
      });
    },
    [setSearchParams],
  );
  const setPage = useCallback(
    (nextPage: number) =>
      updateParams({ page: nextPage <= 1 ? undefined : String(nextPage) }, false),
    [updateParams],
  );
  const clearFilters = useCallback(() => {
    setSearchValue("");
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("query");
      next.delete("project");
      next.delete("page");
      return next;
    });
  }, [setSearchParams]);

  useEffect(() => setSearchValue(query), [query]);
  useEffect(() => {
    const normalized = searchValue.trim();
    if (normalized === query) return;
    const timer = window.setTimeout(() => updateParams({ query: normalized || undefined }), 300);
    return () => window.clearTimeout(timer);
  }, [query, searchValue, updateParams]);

  return {
    clearFilters,
    page,
    project,
    query,
    searchValue,
    setPage,
    setSearchValue,
    status,
    updateParams,
  };
};
