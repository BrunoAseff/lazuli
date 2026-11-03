import { CoinsIcon } from "@phosphor-icons/react/Coins";

export function AiCreditCost({ cost, available }: { cost: number; available?: number }) {
  const format = (value: number) => value.toLocaleString("pt-BR");
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/35 px-4 py-3 text-sm">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <CoinsIcon aria-hidden="true" className="size-5" weight="duotone" />
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <span>Custo: {format(cost)} créditos</span>
        <span className="text-muted-foreground">
          Saldo: {available === undefined ? "…" : format(available)} créditos
        </span>
      </div>
    </div>
  );
}
