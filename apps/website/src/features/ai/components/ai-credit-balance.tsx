import { CoinsIcon } from "@phosphor-icons/react/Coins";

import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useAiCreditBalance } from "../api/ai-queries.ts";

export const AiCreditBalance = () => {
  const balance = useAiCreditBalance();

  return (
    <section
      aria-label="Saldo de créditos de IA"
      className="flex h-12 min-w-0 items-center gap-2.5 bg-muted/60 rounded-md px-2.5 mb-2"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <CoinsIcon aria-hidden="true" className="size-4" weight="duotone" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-sidebar-foreground">Créditos</span>
      <span aria-live="polite" className="shrink-0 text-sm tabular-nums text-muted-foreground">
        {balance.isPending ? (
          <Skeleton aria-label="Carregando saldo" className="h-4 w-8" />
        ) : balance.isError ? (
          <span aria-label="Saldo indisponível">—</span>
        ) : (
          balance.data.available.toLocaleString("pt-BR")
        )}
      </span>
    </section>
  );
};
