import type { ReactNode } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";

export const SettingsSectionHeader = ({ title }: { title: string }) => (
  <header className="mb-6">
    <h1 className="font-heading text-3xl font-medium tracking-tight">{title}</h1>
  </header>
);

export const SettingsSurface = ({
  action,
  children,
  className,
  meta,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  meta?: ReactNode;
  title?: string;
}) => (
  <section className={cn("rounded-[var(--radius-panel)] bg-card/60 p-5 sm:p-6", className)}>
    {(title || meta || action) && (
      <header className="mb-2 flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
        <div className="min-w-0">
          {title && <h3 className="font-heading text-xl font-medium">{title}</h3>}
          {meta && <div className="mt-1 text-sm text-muted-foreground">{meta}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
    )}
    {children}
  </section>
);

export const SettingsField = ({
  action,
  children,
  label,
  message,
}: {
  action?: ReactNode;
  children: ReactNode;
  label: string;
  message?: ReactNode;
}) => (
  <div
    className={cn(
      "grid gap-x-3 gap-y-1.5 py-2 sm:items-start",
      action ? "sm:grid-cols-[4rem_minmax(0,1fr)_10rem]" : "sm:grid-cols-[4rem_minmax(0,1fr)]",
    )}
  >
    <p className="pt-2 text-sm text-muted-foreground">{label}</p>
    <div className="min-w-0">{children}</div>
    {action && <div className="flex items-center gap-1.5 sm:min-h-9 sm:justify-end">{action}</div>}
    {message && (
      <div
        className={cn(
          "text-xs text-muted-foreground sm:col-start-2 sm:min-h-4",
          action && "sm:col-span-2",
        )}
      >
        {message}
      </div>
    )}
  </div>
);

export const SettingsActionRow = ({
  action,
  description,
  label,
}: {
  action?: ReactNode;
  description?: ReactNode;
  label: string;
}) => (
  <div className="grid gap-x-3 gap-y-2 py-2 sm:grid-cols-[4rem_minmax(0,1fr)_10rem] sm:items-center">
    <p className="text-sm text-muted-foreground">{label}</p>
    <div className="min-w-0 text-sm text-foreground">{description}</div>
    {action && <div className="justify-self-start sm:justify-self-end">{action}</div>}
  </div>
);

export const SettingsPreferenceRow = ({
  action,
  align = "start",
  children,
}: {
  action: ReactNode;
  align?: "end" | "start";
  children: ReactNode;
}) => (
  <div
    className={cn(
      "grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-1 sm:grid-cols-[minmax(0,1fr)_10rem]",
      align === "end" ? "items-end sm:relative sm:block" : "items-start",
    )}
  >
    <div className={cn("min-w-0", align === "end" && "sm:pr-44")}>{children}</div>
    <div
      className={cn(
        "flex justify-start sm:justify-end",
        align === "end" ? "items-end sm:absolute sm:right-0 sm:bottom-1" : "items-start",
      )}
    >
      {action}
    </div>
  </div>
);

export const InlineFeedback = ({
  children,
  kind = "neutral",
}: {
  children: ReactNode;
  kind?: "error" | "neutral" | "success";
}) => (
  <p
    className={cn(
      "text-sm",
      kind === "error" && "text-destructive",
      kind === "success" && "text-success",
      kind === "neutral" && "text-muted-foreground",
    )}
    role={kind === "error" ? "alert" : "status"}
  >
    {children}
  </p>
);

export const SettingsLoading = () => (
  <div className="space-y-6" aria-label="Carregando configurações">
    <Skeleton className="h-10 w-48" />
    <div className="rounded-[var(--radius-panel)] bg-card/60 p-6">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-7 h-9 w-full" />
      <Skeleton className="mt-5 h-9 w-full" />
    </div>
  </div>
);

export const SettingsError = ({ onRetry }: { onRetry: () => void }) => (
  <div className="rounded-[var(--radius-panel)] bg-card/60 p-6">
    <h2 className="font-heading text-2xl font-medium">Não foi possível carregar esta seção</h2>
    <p className="mt-2 text-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p>
    <Button className="mt-5" onClick={onRetry} variant="outline">
      Tentar novamente
    </Button>
  </div>
);
