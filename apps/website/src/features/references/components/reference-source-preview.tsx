import { TextQuoteIcon } from "@/components/icons.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import type { Ref } from "react";

export const ReferenceSourcePreview = ({ text }: { text: string }) => (
  <aside className="source-excerpt" aria-label="Trecho de origem">
    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <TextQuoteIcon aria-hidden="true" className="size-3.5" /> Trecho selecionado
    </p>
    <OverflowTooltip text={text}>
      {(ref) => (
        <p
          ref={ref as Ref<HTMLParagraphElement>}
          className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          “{text}”
        </p>
      )}
    </OverflowTooltip>
  </aside>
);
