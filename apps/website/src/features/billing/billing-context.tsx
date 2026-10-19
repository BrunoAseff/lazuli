import type { CommercialLimitDetails, CommercialLimitResource } from "@lazuli/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import { billingKeys, useBillingSummary, useRefreshBillingSummary } from "./api/billing-queries.ts";
import { PlanComparisonDialog } from "./components/plan-comparison-dialog.tsx";
import { PlanLimitDialog } from "./components/plan-limit-dialog.tsx";

type DialogLimitResource = Exclude<CommercialLimitResource, "credits">;

type BillingContextValue = {
  openPlans: () => void;
  openLimit: (resource: DialogLimitResource, details?: CommercialLimitDetails | null) => void;
};

const BillingContext = createContext<BillingContextValue | null>(null);

export const BillingProvider = ({ children }: { children: ReactNode }) => {
  const [plansOpen, setPlansOpen] = useState(false);
  const [limit, setLimit] = useState<{
    resource: DialogLimitResource;
    details?: CommercialLimitDetails | null;
  } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const billingReturn = new URLSearchParams(location.search).get("billing");
  const [confirmation, setConfirmation] = useState<{
    source: "checkout" | "portal";
    startedAt: number;
  } | null>(null);
  const summary = useBillingSummary({ refetchInterval: confirmation ? 2_000 : false });
  const { mutate: refreshSummary } = useRefreshBillingSummary();

  useEffect(() => {
    if (!billingReturn) return;
    if (billingReturn === "canceled") toast.info("Checkout cancelado. Seu plano não foi alterado.");
    if (billingReturn === "success") {
      toast.loading("Confirmando sua assinatura…", { id: "billing-confirmation" });
      setConfirmation({ source: "checkout", startedAt: Date.now() });
      void client.invalidateQueries({ queryKey: billingKeys.summary() });
    }
    if (billingReturn === "portal") {
      toast.loading("Atualizando os dados da assinatura…", { id: "billing-confirmation" });
      setConfirmation({ source: "portal", startedAt: Date.now() });
      refreshSummary(undefined, {
        onSuccess: () => {
          toast.success("Dados da assinatura atualizados.", { id: "billing-confirmation" });
          setConfirmation(null);
        },
        onError: () => void client.invalidateQueries({ queryKey: billingKeys.summary() }),
      });
    }
    const next = new URLSearchParams(location.search);
    next.delete("billing");
    void navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
  }, [billingReturn, client, location.pathname, location.search, navigate, refreshSummary]);

  useEffect(() => {
    if (!confirmation || !summary.data) return;
    const refreshedAfterReturn = summary.dataUpdatedAt >= confirmation.startedAt;
    if (!refreshedAfterReturn) return;
    if (confirmation.source === "portal") return;
    const subscriptionConfirmed =
      summary.data.entitlementSource === "stripe" &&
      (summary.data.subscription?.status === "active" ||
        summary.data.subscription?.status === "trialing");
    if (!subscriptionConfirmed) return;
    toast.success(
      `Plano ${summary.data.plan === "essential" ? "Essencial" : "Especialista"} confirmado.`,
      {
        id: "billing-confirmation",
      },
    );
    setConfirmation(null);
  }, [confirmation, summary.data, summary.dataUpdatedAt]);

  useEffect(() => {
    if (!confirmation) return;
    const timeout = window.setTimeout(() => {
      toast.info(
        "A confirmação ainda está sendo processada. Seu plano será atualizado em instantes.",
        {
          id: "billing-confirmation",
        },
      );
      setConfirmation(null);
    }, 30_000);
    return () => window.clearTimeout(timeout);
  }, [confirmation]);

  const openPlans = useCallback(() => setPlansOpen(true), []);
  const openLimit = useCallback(
    (resource: DialogLimitResource, details?: CommercialLimitDetails | null) =>
      setLimit({ resource, details }),
    [],
  );
  const value = useMemo(() => ({ openLimit, openPlans }), [openLimit, openPlans]);

  return (
    <BillingContext.Provider value={value}>
      {children}
      <PlanComparisonDialog onOpenChange={setPlansOpen} open={plansOpen} />
      <PlanLimitDialog
        details={limit?.details}
        onOpenChange={(open) => !open && setLimit(null)}
        onShowPlans={() => {
          setLimit(null);
          setPlansOpen(true);
        }}
        open={Boolean(limit)}
        resource={limit?.resource ?? "projects"}
      />
    </BillingContext.Provider>
  );
};

export const useBilling = () => {
  const context = useContext(BillingContext);
  if (!context) throw new Error("useBilling must be used inside BillingProvider");
  return context;
};
