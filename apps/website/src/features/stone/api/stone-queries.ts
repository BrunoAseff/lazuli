import type { StoneSessionKind } from "@lazuli/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getClientTimeZone } from "@/features/dashboard/api/dashboard-api.ts";
import { QUERY_KEY_ROOTS } from "@/lib/query-key-roots.ts";
import { fetchStone, fetchStoneContribution, saveStudyGoal } from "./stone-api.ts";

export const stoneKeys = {
  all: QUERY_KEY_ROOTS.stone,
  summary: (timeZone: string) => [...QUERY_KEY_ROOTS.stone, "summary", timeZone] as const,
  contribution: (kind: StoneSessionKind, id: string) =>
    [...QUERY_KEY_ROOTS.stone, "contribution", kind, id] as const,
};

export const useStone = () => {
  const timeZone = getClientTimeZone();
  return useQuery({
    queryKey: stoneKeys.summary(timeZone),
    queryFn: ({ signal }) => fetchStone(timeZone, signal),
  });
};

/** What a finished practice or quiz added; read once, when its summary opens. */
export const useStoneContribution = (kind: StoneSessionKind, id: string, enabled = true) => {
  const client = useQueryClient();
  return useQuery({
    enabled: enabled && Boolean(id),
    queryKey: stoneKeys.contribution(kind, id),
    queryFn: async ({ signal }) => {
      const contribution = await fetchStoneContribution(kind, id, getClientTimeZone(), signal);
      // The session changed the stone: the home card and "Sua pedra" read it again.
      void client.invalidateQueries({ queryKey: [...stoneKeys.all, "summary"] });
      return contribution;
    },
    staleTime: Infinity,
  });
};

export const useSaveStudyGoal = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: saveStudyGoal,
    // The home page shows the goal too, and its first steps end with setting it.
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: stoneKeys.all }),
        client.invalidateQueries({ queryKey: QUERY_KEY_ROOTS.dashboard }),
      ]),
  });
};
