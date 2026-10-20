import { CreditCardIcon } from "@phosphor-icons/react/CreditCard";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu.tsx";
import { useBilling } from "../billing-context.tsx";

export const ManageSubscriptionAction = () => {
  const { openPlans } = useBilling();
  return (
    <DropdownMenuItem onSelect={openPlans}>
      <CreditCardIcon aria-hidden="true" weight="duotone" />
      Planos e assinatura
    </DropdownMenuItem>
  );
};
