import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils.ts";

export const StudySummaryMetric = ({
  children,
  className,
  icon: Icon,
  strong = false,
}: {
  children: ReactNode;
  className?: string;
  icon: ComponentType<{ className?: string }>;
  strong?: boolean;
}) => (
  <span
    className={cn(
      "flex min-w-0 items-center gap-1.5 whitespace-nowrap",
      strong && "text-foreground",
      className,
    )}
  >
    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
    <span>{children}</span>
  </span>
);
