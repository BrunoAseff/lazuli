import type { ComponentType, Ref } from "react";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";

import { cn } from "@/lib/utils.ts";

export const StudySummaryMetric = ({
  children,
  className,
  icon: Icon,
  strong = false,
}: {
  children: string | number | (string | number)[];
  className?: string;
  icon: ComponentType<{ className?: string }>;
  strong?: boolean;
}) => (
  <span
    className={cn(
      "flex min-w-0 items-start gap-1.5 leading-4",
      strong && "text-foreground",
      className,
    )}
  >
    <Icon className="mt-px size-3.5 shrink-0 text-muted-foreground" />
    <OverflowTooltip text={Array.isArray(children) ? children.join("") : String(children)}>
      {(ref) => (
        <span ref={ref as Ref<HTMLSpanElement>} className="min-w-0 truncate">
          {children}
        </span>
      )}
    </OverflowTooltip>
  </span>
);
