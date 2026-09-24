import { SquareCheckBig } from "lucide-react";

import { cn } from "@/lib/utils.ts";

export const QuizCollectionMark = ({ className }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={cn("relative block size-9 shrink-0 text-muted-foreground", className)}
  >
    <span className="absolute inset-x-1 top-0 h-7 rounded-lg border bg-background" />
    <span className="absolute inset-x-0 bottom-0 flex h-7 items-center justify-center rounded-lg border bg-card">
      <SquareCheckBig className="size-4" strokeWidth={1.7} />
    </span>
  </span>
);
