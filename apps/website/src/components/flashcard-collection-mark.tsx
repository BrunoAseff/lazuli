import { cn } from "@/lib/utils.ts";
import { FlashcardDomainIcon } from "@/components/domain-icons.ts";

export const FlashcardCollectionMark = ({ className }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={cn(
      "grid size-9 shrink-0 place-items-center rounded-lg bg-muted/50 text-muted-foreground",
      className,
    )}
  >
    <FlashcardDomainIcon className="size-5" />
  </span>
);
