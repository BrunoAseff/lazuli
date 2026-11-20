import { CalendarXIcon } from "@/components/icons.tsx";
import { WarningCircleIcon } from "@/components/icons.tsx";

import { Button } from "@/components/ui/button.tsx";
import { useBillingSummary, useOpenBillingPortal } from "../api/billing-queries.ts";
import { formatDate } from "../billing-formatters.ts";
import {
  hasBillingPaymentProblem,
  hasPausedSubscription,
  hasScheduledCancellation,
} from "../billing-subscription-state.ts";

export const BillingStatusNotice = () => {
  const { data } = useBillingSummary();
  const portal = useOpenBillingPortal();
  const subscription = data?.subscription;
  if (!subscription) return null;

  const paymentProblem = hasBillingPaymentProblem(data);
  const cancellationScheduled = hasScheduledCancellation(data);
  const paused = hasPausedSubscription(data);
  const cancellationDate = subscription.accessUntil ?? subscription.currentPeriodEnd;
  if (!paymentProblem && !cancellationScheduled && !paused) return null;

  return (
    <div className="mx-2 grid gap-2 rounded-[var(--radius)] border bg-muted/35 p-3 text-xs">
      <div className="flex items-start gap-2">
        {paymentProblem ? (
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
        ) : (
          <CalendarXIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <p className="leading-relaxed text-muted-foreground">
          {paymentProblem
            ? "Há um problema com a cobrança da sua assinatura. Atualize o pagamento para evitar a perda dos limites do plano."
            : paused
              ? "Sua assinatura está pausada. Retome-a para voltar a usar os limites do plano pago."
              : `Cancelamento agendado. Seu plano continua ativo${cancellationDate ? ` até ${formatDate(cancellationDate)}` : " até o fim do período atual"}.`}
        </p>
      </div>
      <Button
        onClick={() => portal.mutate()}
        pending={portal.isPending}
        pendingLabel="Abrindo"
        size="sm"
        variant="outline"
      >
        {paymentProblem
          ? "Atualizar pagamento"
          : paused
            ? "Retomar assinatura"
            : "Reativar assinatura"}
      </Button>
    </div>
  );
};
