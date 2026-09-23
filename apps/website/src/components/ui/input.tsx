import * as React from "react";

import { cn } from "@/lib/utils";
import { controlTransition } from "@/components/ui/ui-styles.ts";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        `h-9 w-full min-w-0 rounded-[var(--radius)] border border-input bg-card px-3 py-1 text-base outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-normal file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-55 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-sm ${controlTransition}`,
        className,
      )}
      {...props}
    />
  );
}

export { Input };
