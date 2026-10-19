import type { ReactNode } from "react";

import { useBilling } from "../billing-context.tsx";
import { UpgradeHoverCard } from "./upgrade-hover-card.tsx";

export const CreditUpgradeGuard = ({
  available,
  children,
  cost,
}: {
  available: number | undefined;
  children: ReactNode;
  cost: number;
}) => {
  const { openPlans } = useBilling();
  if (available === undefined || available >= cost) return children;

  return (
    <UpgradeHoverCard
      description={`Esta geração custa ${cost.toLocaleString("pt-BR")} créditos, mas você tem ${available.toLocaleString("pt-BR")}. Compare os planos para continuar gerando materiais.`}
      title="Créditos insuficientes"
    >
      <span
        className="inline-flex w-full cursor-not-allowed sm:w-auto"
        onClick={openPlans}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          openPlans();
        }}
        role="button"
        tabIndex={0}
      >
        {children}
      </span>
    </UpgradeHoverCard>
  );
};
