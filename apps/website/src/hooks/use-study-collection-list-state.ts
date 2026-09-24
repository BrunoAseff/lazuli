import {
  studyCollectionListQueryShape,
  studyCollectionProjectFilterSchema,
  type StudyCollectionStatus,
} from "@lazuli/shared";
import { useCallback } from "react";
import { useSearchParams } from "react-router";

import { parsePositivePage } from "@/lib/pagination.ts";
import { mergeSearchParams } from "@/lib/search-params.ts";
import { useDebouncedSearch } from "@/hooks/use-debounced-search.ts";

const collectionListDefaults = { status: "active" };

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
  const page = parsePositivePage(searchParams.get("page"));

  const updateParams = useCallback(
    (changes: Record<string, string | undefined>, resetPage = true) => {
      setSearchParams((current) =>
        mergeSearchParams(current, changes, {
          defaults: collectionListDefaults,
          resetPage,
        }),
      );
    },
    [setSearchParams],
  );
  const [searchValue, setSearchValue] = useDebouncedSearch(query, (value) =>
    updateParams({ query: value || undefined }),
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
