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

export const BrandBadge = ({ className, ...props }: ComponentProps<"span">) => (
  <span
    aria-hidden="true"
    className={cn(
      "flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)] border border-primary/25 bg-primary/5 text-primary",
      className,
    )}
    {...props}
  >
    <BrandMark className="size-5" />
  </span>
);
