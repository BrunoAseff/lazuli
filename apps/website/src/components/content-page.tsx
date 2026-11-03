import type { ReactNode } from "react";

import { cn } from "@/lib/utils.ts";

export const ContentPage = ({
  children,
  className,
  maxWidth = "6xl",
}: {
  children: ReactNode;
  className?: string;
  maxWidth?: "5xl" | "6xl";
}) => (
  <div className={cn("flex flex-1 flex-col px-5 py-5 sm:px-8 sm:py-6 lg:px-10 lg:py-7", className)}>
    <div className={cn("mx-auto w-full", maxWidth === "6xl" ? "max-w-6xl" : "max-w-5xl")}>
      {children}
    </div>
  </div>
);
