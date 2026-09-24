import type { ReactNode } from "react";

import { cn } from "@/lib/utils.ts";

export const ContentPage = ({
  children,
  className,
  maxWidth = "5xl",
}: {
  children: ReactNode;
  className?: string;
  maxWidth?: "5xl" | "6xl";
}) => (
  <div className={cn("flex flex-1 flex-col px-5 py-8 sm:px-8 lg:px-12 lg:py-10", className)}>
    <div className={cn("mx-auto w-full", maxWidth === "6xl" ? "max-w-6xl" : "max-w-5xl")}>
      {children}
    </div>
  </div>
);
