import type { ComponentProps } from "react";

import { cn } from "@/lib/utils.ts";

/** Keyboard hint. Decorative by default: the action keeps its own accessible name. */
export const Kbd = ({ className, ...props }: ComponentProps<"kbd">) => (
  <kbd
    aria-hidden="true"
    className={cn(
      "inline-flex h-5 min-w-5 items-center justify-center rounded-[0.3125rem] bg-[color-mix(in_oklab,currentColor_12%,transparent)] px-1.5 font-sans text-[0.6875rem] leading-none font-medium tabular-nums opacity-80",
      className,
    )}
    {...props}
  />
);
