import type { ComponentProps } from "react";

import { cn } from "@/lib/utils.ts";

export const StudyItemShell = ({
  className,
  mode,
  ...props
}: ComponentProps<"article"> & {
  mode: "cards" | "table";
}) => (
  <article
    className={cn(
      "group relative min-w-0 bg-background transition-colors hover:bg-muted/45",
      mode === "cards"
        ? "flex min-h-56 flex-col border p-5"
        : "grid gap-3 py-4 sm:items-center sm:px-3",
      className,
    )}
    {...props}
  />
);

export const StudyItemActions = ({
  className,
  mode,
  ...props
}: ComponentProps<"div"> & {
  mode: "cards" | "table";
}) => (
  <div
    className={cn(mode === "cards" ? "absolute top-3 right-3" : "justify-self-end", className)}
    {...props}
  />
);
