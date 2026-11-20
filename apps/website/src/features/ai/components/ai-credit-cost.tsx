/** The cost of a generation and the balance it draws from, in one quiet line. */
export function AiCreditCost({ cost, available }: { cost: number; available?: number }) {
  const format = (value: number) => value.toLocaleString("pt-BR");
  return (
    <p className="min-w-0 py-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{format(cost)} créditos</span> · saldo{" "}
      {available === undefined ? "…" : format(available)}
    </p>
  );
}
