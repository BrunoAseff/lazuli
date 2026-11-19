import { CreditCardIcon } from "@/components/icons.tsx";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu.tsx";
import { useBilling } from "../billing-context.tsx";

export const ManageSubscriptionAction = () => {
  const { openPlans } = useBilling();
  return (
    <DropdownMenuItem onSelect={openPlans}>
      <CreditCardIcon aria-hidden="true" />
      Planos e assinatura
    </DropdownMenuItem>
  );
};
