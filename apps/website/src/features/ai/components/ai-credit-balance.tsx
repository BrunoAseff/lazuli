import { CoinsIcon } from "@phosphor-icons/react/Coins";
import { ArrowUpRightIcon } from "@phosphor-icons/react/ArrowUpRight";
import { HardDriveIcon } from "@phosphor-icons/react/HardDrive";
import { Link } from "react-router";

import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { useBillingSummary } from "@/features/billing/api/billing-queries.ts";
import { useBilling } from "@/features/billing/billing-context.tsx";
import { BillingUsage } from "@/features/billing/components/billing-usage.tsx";
import { UpgradeHoverCard } from "@/features/billing/components/upgrade-hover-card.tsx";
import { formatBytes } from "@/features/billing/billing-formatters.ts";

const formatRenewalDate = (value: string) => {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")} ${part("month").replace(".", "")} ${part("year")}`;
};

export const AiCreditBalance = () => {
  const summary = useBillingSummary();
  const { openPlans } = useBilling();
  const data = summary.data;
  const creditsCritical = data?.credits.severity === "at_limit";
  const creditsNear = data?.credits.severity === "near_limit";
  const showStorage = data && data.storage.severity !== "normal";

  return (
    <div className="grid gap-2">
      <section
        aria-label="Saldo de créditos de IA"
        className={cn(
          "grid min-w-0 gap-2 rounded-lg bg-card/50 p-3",
          creditsCritical && "bg-destructive/10 text-destructive",
        )}
      >
        <Link
          to="/settings/usage"
          aria-label="Ver uso e materiais"
          className="flex min-h-7 items-center gap-2 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className={cn("shrink-0 text-muted-foreground", creditsCritical && "text-destructive")}
          >
            <CoinsIcon aria-hidden="true" className="size-4" weight="duotone" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">Créditos</span>
          <span aria-live="polite" className="shrink-0 text-sm tabular-nums">
            {summary.isPending ? (
              <Skeleton aria-label="Carregando saldo" className="h-4 w-8" />
            ) : data ? (
              data.credits.available.toLocaleString("pt-BR")
            ) : (
              "—"
            )}
          </span>
        </Link>
        {data?.credits.renewsAt && (
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Renova em</span>
            <time className="shrink-0 tabular-nums" dateTime={data.credits.renewsAt}>
              {formatRenewalDate(data.credits.renewsAt)}
            </time>
          </div>
        )}
        {data?.capabilities.canUpgrade && !creditsNear && !creditsCritical && (
          <Button
            className="w-full justify-start px-2 text-[0.8125rem]"
            onClick={openPlans}
            size="sm"
            variant="ghost"
          >
            <ArrowUpRightIcon />
            Fazer upgrade
          </Button>
        )}
        {(creditsNear || creditsCritical) && data && (
          <UpgradeHoverCard
            description={`Você tem ${data.credits.available.toLocaleString("pt-BR")} créditos disponíveis. Compare os planos para aumentar seu limite mensal.`}
            side="right"
            title={creditsCritical ? "Créditos esgotados" : "Seus créditos estão acabando"}
          >
            <Button
              className="w-full"
              onClick={openPlans}
              size="sm"
              variant={creditsCritical ? "destructive" : "outline"}
            >
              <ArrowUpRightIcon />
              Ver planos
            </Button>
          </UpgradeHoverCard>
        )}
      </section>
      {showStorage && data && (
        <UpgradeHoverCard
          description="Faça upgrade ou remova arquivos para continuar importando documentos."
          side="right"
          title="Armazenamento próximo do limite"
        >
          <button
            className="grid gap-2 rounded-md bg-muted/60 px-2.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
            onClick={openPlans}
            type="button"
          >
            <span className="flex items-center gap-2 text-xs">
              <HardDriveIcon className="size-4 text-primary" weight="duotone" />
              Armazenamento
            </span>
            <BillingUsage
              indicatorClassName="bg-destructive"
              label="Uso"
              percentage={data.storage.percentage}
              value={`${formatBytes(data.storage.usedBytes)} / ${formatBytes(data.storage.limitBytes)}`}
            />
          </button>
        </UpgradeHoverCard>
      )}
    </div>
  );
};
