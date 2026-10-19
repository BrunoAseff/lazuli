import type { CommercialPlan } from "@lazuli/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEY_ROOTS } from "@/lib/query-key-roots.ts";
import {
  createBillingCheckout,
  createBillingPortal,
  fetchBillingPlans,
  fetchBillingSummary,
  refreshBillingSummary,
} from "./billing-api.ts";

export const billingKeys = {
  all: QUERY_KEY_ROOTS.billing,
  plans: () => [...billingKeys.all, "plans"] as const,
  summary: () => [...billingKeys.all, "summary"] as const,
};

export const useBillingPlans = () =>
  useQuery({ queryKey: billingKeys.plans(), queryFn: ({ signal }) => fetchBillingPlans(signal) });

export const useBillingSummary = (options: { refetchInterval?: number | false } = {}) =>
  useQuery({
    queryKey: billingKeys.summary(),
    queryFn: ({ signal }) => fetchBillingSummary(signal),
    staleTime: 30_000,
    refetchInterval: options.refetchInterval,
  });

export const useRefreshBillingSummary = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: refreshBillingSummary,
    onSuccess: (summary) => client.setQueryData(billingKeys.summary(), summary),
  });
};

const navigateToBillingDestination = ({ url }: { url: string }) => window.location.assign(url);
const getReturnPath = () => `${window.location.pathname}${window.location.search}`;

export const useStartCheckout = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (plan: CommercialPlan) => createBillingCheckout(plan, getReturnPath()),
    onSuccess: navigateToBillingDestination,
    onSettled: async () => client.invalidateQueries({ queryKey: billingKeys.summary() }),
  });
};

export const useOpenBillingPortal = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => createBillingPortal(getReturnPath()),
    onSuccess: navigateToBillingDestination,
    onSettled: async () => client.invalidateQueries({ queryKey: billingKeys.summary() }),
  });
};
