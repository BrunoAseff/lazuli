import type { ReactNode } from "react";

import { cn } from "@/lib/utils.ts";

export const StudyCollectionCard = ({
  actions,
  children,
  identity,
  favorite,
}: {
  actions: ReactNode;
  children: ReactNode;
  identity: ReactNode;
  favorite?: ReactNode;
}) => (
  <article className="grid min-w-0 gap-4 rounded-xl border bg-card px-4 py-4 transition-colors hover:bg-accent/45 sm:px-5">
    <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">{identity}</div>
        {favorite && <div className="shrink-0 sm:hidden">{favorite}</div>}
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:justify-self-end">
        {favorite && <div className="hidden sm:block">{favorite}</div>}
        {actions}
      </div>
    </div>
    <div className="grid min-w-0 gap-4 border-t pt-4 sm:grid-cols-3 sm:gap-0 sm:divide-x">
      {children}
    </div>
  </article>
);

export const StudyCollectionMetric = ({
  children,
  className,
  description,
  icon,
  label,
  value,
}: {
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) => (
  <div
    className={cn(
      "grid min-w-0 grid-cols-[auto_minmax(0,1fr)] content-start gap-x-2 gap-y-0.5 sm:px-4 first:pl-0 last:pr-0",
      className,
    )}
  >
    <span className="row-span-3 mt-0.5 text-muted-foreground">{icon}</span>
    <p className="text-xs text-muted-foreground">{label}</p>
    <div className="min-w-0 text-sm font-medium leading-snug">{value}</div>
    {description ? (
      <p className="col-start-2 text-xs leading-snug text-muted-foreground">{description}</p>
    ) : null}
    {children ? <div className="col-start-2 mt-1.5">{children}</div> : null}
  </div>
);
