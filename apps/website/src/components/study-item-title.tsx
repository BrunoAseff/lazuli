import type { Ref } from "react";

import { HighlightText } from "@/components/highlight-text.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { cn } from "@/lib/utils.ts";

export const StudyItemTitle = ({
  fallback = "Pergunta com imagem",
  query,
  text,
}: {
  fallback?: string;
  query: string;
  text: string;
}) => {
  const normalizedText = text.trim();
  const displayText = normalizedText || fallback;

  return (
    <OverflowTooltip text={displayText}>
      {(ref) => (
        <span
          className={cn(
            "block truncate font-heading text-[0.9rem] leading-5",
            !normalizedText && "font-sans font-normal italic text-muted-foreground/80",
          )}
          ref={ref as Ref<HTMLSpanElement>}
        >
          <HighlightText query={normalizedText ? query : ""} text={displayText} />
        </span>
      )}
    </OverflowTooltip>
  );
};
