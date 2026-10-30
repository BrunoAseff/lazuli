import {
  AI_CREDITS_PER_ITEM,
  COMMERCIAL_PLAN_CATALOG,
  type CommercialPlan,
  type CommercialPlanDefinition,
  type CommercialSummary,
} from "@lazuli/shared";
import { CheckCircleIcon } from "@phosphor-icons/react/CheckCircle";
import { BookOpenIcon } from "@phosphor-icons/react/BookOpen";
import { CrownIcon } from "@phosphor-icons/react/Crown";
import { MedalIcon } from "@phosphor-icons/react/Medal";

import { Button } from "@/components/ui/button.tsx";
import { LegalLinks } from "@/features/legal/legal-links.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { cn } from "@/lib/utils.ts";
import { getApiErrorMessage } from "@/lib/api-client.ts";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { formatBytes, formatDate, formatPrice } from "../billing-formatters.ts";
import {
  hasBillingPaymentProblem,
  hasPausedSubscription,
  hasScheduledCancellation,
} from "../billing-subscription-state.ts";
import {
  useBillingPlans,
  useBillingSummary,
  useOpenBillingPortal,
  useRefreshBillingSummary,
  useStartCheckout,
} from "../api/billing-queries.ts";

export const getPlanAction = (
  plan: CommercialPlan,
  summary: Pick<
    CommercialSummary,
    "billingAction" | "capabilities" | "entitlementSource" | "plan" | "subscription"
  >,
) => {
  const current = summary.plan;
  const recoveryPlan = summary.subscription?.plan === plan;
  if (recoveryPlan && hasBillingPaymentProblem(summary)) return "Atualizar pagamento";
  if (recoveryPlan && hasPausedSubscription(summary)) return "Retomar assinatura";
  if (plan === current) {
    if (hasScheduledCancellation(summary)) return "Reativar assinatura";
    return summary.entitlementSource === "stripe" ? "Cancelar assinatura" : "Plano atual";
  }
  if (summary.entitlementSource === "admin") return "Concessão administrativa";
  if (hasScheduledCancellation(summary) && plan === "basic") return "Troca agendada";
  if (summary.billingAction === "portal")
    return `Trocar para ${COMMERCIAL_PLAN_CATALOG[plan].name}`;
  return "Escolher plano";
};

export const canSelectPlan = (
  plan: CommercialPlan,
  summary: Pick<CommercialSummary, "billingAction" | "entitlementSource" | "plan" | "subscription">,
) => {
  if (summary.entitlementSource === "admin") return false;
  if (hasScheduledCancellation(summary) && plan === "basic") return false;
  const recoveryPlan =
    summary.subscription?.plan === plan &&
    (hasBillingPaymentProblem(summary) || hasPausedSubscription(summary));
  if (plan === summary.plan) return summary.entitlementSource === "stripe" || recoveryPlan;
  return plan !== "basic" || summary.billingAction === "portal";
};

const PlanCard = ({
  summary,
  disabled,
  loading,
  onSelect,
  plan,
}: {
  disabled: boolean;
  loading: boolean;
  onSelect: (plan: CommercialPlan) => void;
  plan: CommercialPlanDefinition;
  summary: CommercialSummary;
}) => {
  const active = plan.code === summary.plan;
  const cancellationScheduled = hasScheduledCancellation(summary);
  const paymentProblem = hasBillingPaymentProblem(summary);
  const paused = hasPausedSubscription(summary);
  const recoveryPlan = summary.subscription?.plan === plan.code && (paymentProblem || paused);
  const cancellationDate =
    summary.subscription?.accessUntil ?? summary.subscription?.currentPeriodEnd ?? null;
  const scheduledBasicPlan = cancellationScheduled && plan.code === "basic";
  const estimatedMaterials = Math.floor(plan.monthlyAiCredits / AI_CREDITS_PER_ITEM);
  const PlanIcon =
    plan.code === "basic" ? BookOpenIcon : plan.code === "essential" ? MedalIcon : CrownIcon;
  return (
    <article
      className={cn(
        "relative flex min-w-0 flex-col gap-5 rounded-[var(--radius-overlay)] border bg-card p-5",
        plan.recommended && "border-primary/55",
      )}
    >
      {plan.recommended && (
        <span className="absolute -top-3 left-4 rounded-full bg-primary px-2.5 py-1 text-xs text-primary-foreground">
          Recomendado
        </span>
      )}
      <div className="grid gap-1">
        <div className="flex items-center gap-2">
          <PlanIcon aria-hidden="true" className="size-4 text-primary" weight="duotone" />
          <h3 className="font-heading text-xl">{plan.name}</h3>
        </div>
        <p className="text-2xl tabular-nums">
          {plan.monthlyPriceCents === 0 ? "Grátis" : formatPrice(plan.monthlyPriceCents)}
          {plan.monthlyPriceCents > 0 && (
            <span className="text-xs text-muted-foreground">/mês</span>
          )}
        </p>
        {active && cancellationScheduled && cancellationDate && (
          <p className="text-xs font-medium text-primary">
            Ativo até {formatDate(cancellationDate)}
          </p>
        )}
        {scheduledBasicPlan && (
          <p className="text-xs font-medium text-muted-foreground">Próximo plano</p>
        )}
        {recoveryPlan && (
          <p className="text-xs font-medium text-destructive">
            {paymentProblem ? "Pagamento pendente" : "Assinatura pausada"}
          </p>
        )}
      </div>
      <ul className="grid gap-2.5 text-sm">
        <li className="flex gap-2">
          <CheckCircleIcon className="mt-0.5 size-4 text-primary" />
          {plan.projectLimit === null ? "Projetos ilimitados" : `${plan.projectLimit} projetos`}
        </li>
        <li className="flex gap-2">
          <CheckCircleIcon className="mt-0.5 size-4 text-primary" />
          {formatBytes(plan.storageLimitBytes)} de armazenamento
        </li>
        <li className="flex gap-2">
          <CheckCircleIcon className="mt-0.5 size-4 text-primary" />
          {plan.monthlyAiCredits.toLocaleString("pt-BR")} créditos de IA/mês
        </li>
        <li className="text-xs leading-relaxed text-muted-foreground">
          Cerca de {estimatedMaterials.toLocaleString("pt-BR")} materiais por mês.
        </li>
      </ul>
      <Button
        className="mt-auto w-full"
        disabled={disabled || !canSelectPlan(plan.code, summary)}
        onClick={() => onSelect(plan.code)}
        variant={
          active &&
          summary.entitlementSource === "stripe" &&
          !cancellationScheduled &&
          !paymentProblem &&
          !paused
            ? "destructive"
            : plan.recommended && !active
              ? "default"
              : "outline"
        }
      >
        {loading && <Spinner />}
        {getPlanAction(plan.code, summary)}
      </Button>
    </article>
  );
};

export const PlanComparisonDialog = ({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const plans = useBillingPlans();
  const summary = useBillingSummary();
  const checkout = useStartCheckout();
  const portal = useOpenBillingPortal();
  const refreshSummary = useRefreshBillingSummary();
  const refreshedForCurrentOpen = useRef(false);
  const busy = checkout.isPending || portal.isPending;
  const [pendingPlan, setPendingPlan] = useState<CommercialPlan | null>(null);

  useEffect(() => {
    const error = checkout.error ?? portal.error;
    if (!error) return;
    toast.error(getApiErrorMessage(error, "Não foi possível abrir a cobrança. Tente novamente."));
  }, [checkout.error, portal.error]);

  useEffect(() => {
    if (!open) {
      refreshedForCurrentOpen.current = false;
      return;
    }
    if (refreshedForCurrentOpen.current || !summary.data?.subscription || refreshSummary.isPending)
      return;
    refreshedForCurrentOpen.current = true;
    refreshSummary.mutate();
  }, [open, refreshSummary, summary.data?.subscription]);

  const selectPlan = (plan: CommercialPlan) => {
    if (!summary.data) return;
    if (!canSelectPlan(plan, summary.data)) return;
    setPendingPlan(plan);
    if (summary.data.billingAction === "portal")
      portal.mutate(undefined, { onError: () => setPendingPlan(null) });
    else if (plan !== "basic") checkout.mutate(plan, { onError: () => setPendingPlan(null) });
    else setPendingPlan(null);
  };

  return (
    <Dialog onOpenChange={(next) => !busy && onOpenChange(next)} open={open}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Planos do Lazúli</DialogTitle>
          <DialogDescription className="sr-only">
            Comparação dos recursos e limites disponíveis em cada plano.
          </DialogDescription>
        </DialogHeader>
        {plans.isPending || summary.isPending || refreshSummary.isPending ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <Skeleton className="h-72 rounded-[var(--radius-overlay)]" key={item} />
            ))}
          </div>
        ) : plans.isError || summary.isError || !plans.data || !summary.data ? (
          <div className="rounded-[var(--radius)] border p-5 text-sm text-muted-foreground">
            Não foi possível carregar os planos. Tente novamente.
          </div>
        ) : (
          <>
            {hasScheduledCancellation(summary.data) && (
              <div className="rounded-[var(--radius)] border border-primary/30 bg-primary/5 p-4 text-sm">
                <p className="font-medium">Cancelamento agendado</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  Seu plano {COMMERCIAL_PLAN_CATALOG[summary.data.plan].name} continua ativo
                  {(summary.data.subscription?.accessUntil ??
                  summary.data.subscription?.currentPeriodEnd)
                    ? ` até ${formatDate(summary.data.subscription.accessUntil ?? summary.data.subscription?.currentPeriodEnd ?? null)}`
                    : " até o fim do período atual"}
                  . Depois disso, sua conta volta automaticamente para o plano Básico. Você pode
                  reativar a assinatura antes dessa data.
                </p>
              </div>
            )}
            {hasBillingPaymentProblem(summary.data) && (
              <div className="rounded-[var(--radius)] border border-destructive/35 bg-destructive/5 p-4 text-sm">
                <p className="font-medium text-destructive">Pagamento pendente</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  Atualize a forma de pagamento para manter os limites do seu plano.
                </p>
              </div>
            )}
            {hasPausedSubscription(summary.data) && (
              <div className="rounded-[var(--radius)] border p-4 text-sm">
                <p className="font-medium">Assinatura pausada</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  Retome a assinatura para voltar a usar os limites do plano pago.
                </p>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-3">
              {plans.data.items.map((plan) => (
                <PlanCard
                  disabled={busy}
                  key={plan.code}
                  loading={pendingPlan === plan.code}
                  onSelect={selectPlan}
                  plan={plan}
                  summary={summary.data}
                />
              ))}
            </div>
          </>
        )}
        {summary.data?.entitlementSource === "admin" && (
          <p className="text-xs text-muted-foreground">
            Seu plano atual foi concedido administrativamente e não possui cobrança vinculada.
          </p>
        )}
        <DialogFooter>
          <LegalLinks newTab className="mr-auto self-center text-xs" />
          <Button disabled={busy} onClick={() => onOpenChange(false)} variant="outline">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
