import * as React from "react";

import { cn } from "@/lib/utils";
import { controlTransition } from "@/components/ui/ui-styles.ts";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        `flex field-sizing-content min-h-16 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-55 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-sm ${controlTransition}`,
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
