"use client";

import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Progress({
  className,
  indicatorClassName,
  value,
  max = 100,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      max={max}
      className={cn(
        "relative flex h-1.5 w-full items-center overflow-hidden rounded-full bg-primary/12",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "relative size-full flex-1 rounded-full bg-primary transition-transform duration-[var(--spring-settle-duration)] ease-[var(--spring-settle)] motion-reduce:transition-none",
          indicatorClassName,
        )}
        style={{
          transform: `translateX(-${100 - Math.max(0, Math.min(100, ((value || 0) / max) * 100))}%)`,
        }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 right-0 w-1 rounded-full bg-primary-foreground/25"
        />
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
