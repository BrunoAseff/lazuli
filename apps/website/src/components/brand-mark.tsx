import { DiamondsFourIcon } from "@phosphor-icons/react/DiamondsFour";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils.ts";

export const BrandMark = ({ className, ...props }: ComponentProps<typeof DiamondsFourIcon>) => (
  <DiamondsFourIcon
    aria-hidden="true"
    className={cn("shrink-0 text-primary", className)}
    weight="duotone"
    {...props}
  />
);
