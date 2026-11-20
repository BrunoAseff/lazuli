import {
  stoneContributionSchema,
  stoneResponseSchema,
  studyGoalSchema,
  type StoneSessionKind,
  type StudyGoal,
} from "@lazuli/shared";
import { z } from "zod";

import { getClientTimeZone } from "@/features/dashboard/api/dashboard-api.ts";
import { apiRequest as request } from "@/lib/api-client.ts";

const query = (timeZone: string) => new URLSearchParams({ tz: timeZone }).toString();

export const fetchStone = (timeZone: string, signal?: AbortSignal) =>
  request(`/api/stone?${query(timeZone)}`, stoneResponseSchema, { signal });

export const fetchStoneContribution = (
  kind: StoneSessionKind,
  id: string,
  timeZone: string,
  signal?: AbortSignal,
) =>
  request(
    `/api/stone/contribution/${kind}/${encodeURIComponent(id)}?${query(timeZone)}`,
    stoneContributionSchema,
    { signal },
  );

export const saveStudyGoal = (goal: StudyGoal) =>
  request("/api/stone/goal", z.object({ goal: studyGoalSchema }), {
    method: "PUT",
    body: JSON.stringify({ goal, tz: getClientTimeZone() }),
  });
