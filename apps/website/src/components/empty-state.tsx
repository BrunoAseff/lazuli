import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils.ts";

export const EmptyState = ({
  action,
  description,
  featuredIcon = false,
  icon: Icon,
  iconClassName,
  minHeight = "md",
  title,
}: {
  action?: ReactNode;
  description: ReactNode;
  featuredIcon?: boolean;
  icon: LucideIcon;
  iconClassName?: string;
  minHeight?: "md" | "lg";
  title: string;
}) => (
  <section
    className={cn(
      "grid place-items-center border border-dashed bg-card/40 px-5 text-center",
      minHeight === "lg" ? "min-h-72" : "min-h-64",
    )}
  >
    <div className="max-w-sm">
      <span
        className={cn(
          "mx-auto mb-4 flex items-center justify-center text-muted-foreground",
          featuredIcon ? "size-11 border bg-background text-primary" : "size-7",
          iconClassName,
        )}
      >
        <Icon aria-hidden="true" className={featuredIcon ? "size-5" : "size-7"} />
      </span>
      <h2 className="font-heading text-2xl font-medium">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">{description}</div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  </section>
);
