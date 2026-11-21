import type { ComponentType, ReactNode } from "react";

import { TriangleAlertIcon } from "@/components/icons.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";

export const EmptyState = ({
  action,
  description,
  icon: Icon,
  iconClassName,
  minHeight = "md",
  title,
  compact = false,
  className,
  surface = "panel",
}: {
  action?: ReactNode;
  description?: ReactNode;
  icon: ComponentType<{ className?: string }>;
  iconClassName?: string;
  minHeight?: "sm" | "md" | "lg";
  title: string;
  compact?: boolean;
  className?: string;
  surface?: "panel" | "inline";
}) => (
  <section
    className={cn(
      "grid place-items-center rounded-[var(--radius-panel)] px-5 py-7 text-center",
      surface === "panel" ? "border border-border/50 bg-card" : "bg-transparent",
      minHeight === "lg" ? "sm:min-h-72" : minHeight === "sm" ? "sm:min-h-44" : "sm:min-h-64",
      className,
    )}
  >
    <div className="empty-state max-w-sm">
      {/* A plain glyph, no tile: the title carries the message. */}
      <span
        aria-hidden="true"
        className={cn("mb-3 flex justify-center text-muted-foreground", iconClassName)}
      >
        <Icon className="size-6" />
      </span>
      <h2 className={cn("font-reading font-normal", compact ? "text-lg" : "text-xl")}>{title}</h2>
      {description && (
        <div className="mt-2 text-sm leading-6 text-muted-foreground">{description}</div>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  </section>
);

/**
 * The one "could not load" state: the alert glyph, what did not load, and a way to try again
 * (outlined, since the page's filled action belongs to the content that failed).
 */
export const LoadError = ({
  description = "Confira sua conexão e tente novamente.",
  onRetry,
  ...props
}: {
  description?: ReactNode;
  onRetry: () => void;
  title: string;
} & Pick<Parameters<typeof EmptyState>[0], "className" | "compact" | "minHeight" | "surface">) => (
  <EmptyState
    {...props}
    action={
      <Button onClick={onRetry} variant="outline">
        Tentar novamente
      </Button>
    }
    description={description}
    icon={TriangleAlertIcon}
    iconClassName="text-destructive"
  />
);
