import type { ReactNode } from "react";
import { cn } from "@/lib/utils.ts";

export const chartTooltipClass =
  "rounded-[var(--radius)] border-0 bg-popover p-3 text-xs text-popover-foreground shadow-[var(--shadow-overlay)] ring-1 ring-border";

export function ChartTooltipSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(chartTooltipClass, className)}>{children}</div>;
}

export function ChartTooltipValues({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: ReactNode; color?: string }[];
}) {
  return (
    <div className="space-y-2">
      <p className="font-medium">{title}</p>
      <dl className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-5">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              {item.color && (
                <span
                  aria-hidden
                  className="size-2 rounded-sm"
                  style={{ background: item.color }}
                />
              )}
              {item.label}
            </dt>
            <dd className="font-medium tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
