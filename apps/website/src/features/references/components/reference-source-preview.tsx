import { TextQuoteIcon } from "lucide-react";

export const ReferenceSourcePreview = ({ text }: { text: string }) => (
  <aside className="border-l-2 border-primary/50 pl-3" aria-label="Trecho de origem">
    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <TextQuoteIcon aria-hidden="true" className="size-3.5 text-primary" /> Trecho selecionado
    </p>
    <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">“{text}”</p>
  </aside>
);
