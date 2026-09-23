import { cn } from "@/lib/utils.ts";

export const FlashcardCollectionMark = ({ className }: { className?: string }) => (
  <span aria-hidden="true" className={cn("relative block size-9 shrink-0", className)}>
    <span className="absolute top-0.5 left-0.5 size-7 rounded-lg border border-border bg-card" />
    <span className="absolute right-0.5 bottom-0.5 size-7 rounded-lg border border-border bg-card" />
  </span>
);
