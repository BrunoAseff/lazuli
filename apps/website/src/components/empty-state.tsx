import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils.ts";

export const EmptyState = ({
  action,
  description,
  icon: Icon,
  iconClassName,
  minHeight = "md",
  title,
}: {
  action?: ReactNode;
  description: ReactNode;
  icon: ComponentType<{ className?: string }>;
  iconClassName?: string;
  minHeight?: "sm" | "md" | "lg";
  title: string;
}) => (
  <section
    className={cn(
      "grid place-items-center rounded-xl border border-dashed bg-card/40 px-5 text-center",
      minHeight === "lg" ? "min-h-72" : minHeight === "sm" ? "min-h-44" : "min-h-64",
    )}
  >
    <div className="max-w-sm">
      <span
        aria-hidden="true"
        className={cn(
          "mx-auto mb-4 flex size-11 items-center justify-center rounded-[var(--radius)] border border-primary/25 bg-primary/5 text-primary",
          iconClassName,
        )}
      >
        <Icon className="size-5" />
      </span>
      <h2 className="font-heading text-2xl font-medium">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">{description}</div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  </section>
);
