import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  studyMetricsResponseSchema,
  studyMetricsRankingSchema,
  studyMetricsAttemptsSchema,
  studyMetricsCollectionsSchema,
  type StudyMetricsView,
  type StudyMetricsQuery,
  type StudyMetricsCollections,
} from "@lazuli/shared";
import { apiRequest, ApiError } from "@/lib/api-client.ts";
import { authClient } from "@/features/auth/auth-client.ts";

export const studyMetricsKey = ["study-metrics"] as const;
const metricsRetry = (attempt: number, error: unknown) =>
  !(error instanceof ApiError && error.status >= 400 && error.status < 500) && attempt < 1;
export function useMetrics(view: StudyMetricsView, input: StudyMetricsQuery, valid: boolean) {
  const { data: session } = authClient.useSession();
  return useQuery({
    retry: metricsRetry,
    queryKey: [...studyMetricsKey, session?.user.id, view, "summary", input],
    enabled: valid && Boolean(session?.user.id),
    queryFn: ({ signal }) =>
      apiRequest(
        `/api/study-metrics/${view}/summary?${new URLSearchParams(input)}`,
        studyMetricsResponseSchema,
        { signal },
      ),
    staleTime: 30000,
  });
}
export function useMetricsRanking(
  view: StudyMetricsView,
  input: StudyMetricsQuery,
  page: number,
  includeArchived: boolean,
  order: "errors" | "correct",
) {
  const { data: session } = authClient.useSession();
  return useQuery({
    retry: metricsRetry,
    queryKey: [
      ...studyMetricsKey,
      session?.user.id,
      view,
      "ranking",
      input,
      page,
      includeArchived,
      order,
    ],
    enabled: view !== "overview" && Boolean(session?.user.id),
    queryFn: ({ signal }) =>
      apiRequest(
        `/api/study-metrics/${view}/ranking?${new URLSearchParams({ ...input, page: String(page), includeArchived: String(includeArchived), order })}`,
        studyMetricsRankingSchema,
        { signal },
      ),
  });
}
export function useMetricsAttempts(input: StudyMetricsQuery, page: number, recent: boolean) {
  const { data: session } = authClient.useSession();
  return useQuery({
    retry: metricsRetry,
    queryKey: [...studyMetricsKey, session?.user.id, "attempts", input, page, recent],
    enabled: Boolean(session?.user.id),
    queryFn: ({ signal }) =>
      apiRequest(
        `/api/study-metrics/quizzes/attempts?${new URLSearchParams({ ...input, page: String(page), recent: String(recent) })}`,
        studyMetricsAttemptsSchema,
        { signal },
      ),
  });
}

export function useMetricsCollectionOptions(view: StudyMetricsView, query: string, open: boolean) {
  const { data: session } = authClient.useSession();
  return useInfiniteQuery({
    retry: metricsRetry,
    queryKey: [...studyMetricsKey, session?.user.id, view, "collection-options", query],
    enabled: open && view !== "overview" && Boolean(session?.user.id),
    initialPageParam: 1,
    getNextPageParam: (last: StudyMetricsCollections, _pages, page) =>
      last.hasMore ? page + 1 : undefined,
    queryFn: ({ signal, pageParam }) =>
      apiRequest(
        `/api/study-metrics/${view}/collections?${new URLSearchParams({ query, page: String(pageParam) })}`,
        studyMetricsCollectionsSchema,
        { signal },
      ),
  });
}
export function useMetricsCollections(
  view: StudyMetricsView,
  query: string,
  page: number,
  selectedId?: string,
) {
  const { data: session } = authClient.useSession();
  return useQuery({
    retry: metricsRetry,
    queryKey: [...studyMetricsKey, session?.user.id, view, "collections", query, page, selectedId],
    enabled: view !== "overview" && Boolean(session?.user.id) && Boolean(selectedId),
    queryFn: ({ signal }) =>
      apiRequest(
        `/api/study-metrics/${view}/collections?${new URLSearchParams({ query, page: String(page), ...(selectedId ? { selectedId } : {}) })}`,
        studyMetricsCollectionsSchema,
        { signal },
      ),
  });
}
