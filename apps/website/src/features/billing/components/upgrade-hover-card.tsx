import type { ComponentProps, ReactElement, ReactNode } from "react";
import { ArrowUpRightIcon } from "@phosphor-icons/react/ArrowUpRight";

import { Button } from "@/components/ui/button.tsx";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card.tsx";
import { useBilling } from "../billing-context.tsx";

export const UpgradeHoverCard = ({
  children,
  description,
  side,
  title,
}: {
  children: ReactElement;
  description: ReactNode;
  side?: ComponentProps<typeof HoverCardContent>["side"];
  title: string;
}) => {
  const { openPlans } = useBilling();
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent align={side ? "center" : "end"} className="grid gap-3" side={side}>
        <div className="grid gap-1">
          <strong className="font-medium">{title}</strong>
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <Button onClick={openPlans} size="sm">
          <ArrowUpRightIcon />
          Ver planos
        </Button>
      </HoverCardContent>
    </HoverCard>
  );
};
