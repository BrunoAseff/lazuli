import type { ReactElement } from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils.ts";

// Composition-only chart surface: tokens and sizing are shared; each feature owns its data.
export function ChartContainer({
  children,
  className,
}: {
  children: ReactElement;
  className?: string;
}) {
  return (
    <div
      data-slot="chart"
      className={cn(
        "h-60 min-w-0 w-full text-xs text-muted-foreground [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/40 [&_.recharts-surface]:overflow-visible",
        className,
      )}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}
