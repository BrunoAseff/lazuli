import type { ReactNode } from "react";

import { cn } from "@/lib/utils.ts";

export const AuthFeedback = ({
  children,
  className,
  kind = "success",
}: {
  children: ReactNode;
  className?: string;
  kind?: "error" | "success";
}) => (
  <div
    className={cn(
      "rounded-[var(--radius)] border px-3 py-2.5 text-sm leading-6",
      kind === "error"
        ? "border-destructive/25 bg-destructive/5 text-destructive"
        : "border-primary/25 bg-primary/5 text-primary",
      className,
    )}
    role={kind === "error" ? "alert" : "status"}
  >
    {children}
  </div>
);
