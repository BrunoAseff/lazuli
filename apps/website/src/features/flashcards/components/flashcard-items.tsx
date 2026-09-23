import type { FlashcardSummary } from "@lazuli/shared";
import { ArchiveIcon, BrainIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import type { Ref } from "react";

import { HighlightText } from "@/components/highlight-text.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { cn } from "@/lib/utils.ts";

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

const scheduleMeta = (card: FlashcardSummary) => {
  if (card.archivedAt) return { Icon: ArchiveIcon, label: "Arquivado" };
  const state = {
    new: { Icon: SparklesIcon, label: "Novo" },
    learning: { Icon: BrainIcon, label: "Aprendendo" },
    review: { Icon: RefreshCwIcon, label: "Revisão" },
    relearning: { Icon: RefreshCwIcon, label: "Reaprendendo" },
  }[card.srsState];
  if (!card.lastReviewedAt) return state;
  const due = new Date(card.dueAt);
  return {
    ...state,
    label:
      due <= new Date()
        ? `${state.label} · disponível agora`
        : `${state.label} · ${date.format(due)}`,
  };
};

export const FlashcardIndex = ({
  activeId,
  cards,
  onOpen,
  onSelect,
  query,
  selected,
}: {
  activeId?: string;
  cards: FlashcardSummary[];
  onOpen: (card: FlashcardSummary) => void;
  onSelect: (cardId: string, selected: boolean) => void;
  query: string;
  selected: Set<string>;
}) => (
  <div className="space-y-1">
    {cards.map((card) => {
      const schedule = scheduleMeta(card);
      return (
        <article
          className={cn(
            "group grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-accent/55",
            activeId === card.id && "bg-accent",
          )}
          key={card.id}
        >
          <Checkbox
            aria-label={`Selecionar flashcard: ${card.questionText}`}
            checked={selected.has(card.id)}
            className="mt-1"
            onCheckedChange={(value) => onSelect(card.id, value === true)}
          />
          <button className="min-w-0 text-left" onClick={() => onOpen(card)} type="button">
            <OverflowTooltip text={card.questionText || "Pergunta com imagem"}>
              {(ref) => (
                <span
                  className="block truncate font-heading text-[0.9rem] leading-5"
                  ref={ref as Ref<HTMLSpanElement>}
                >
                  <HighlightText query={query} text={card.questionText || "Pergunta com imagem"} />
                </span>
              )}
            </OverflowTooltip>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {schedule.label}
            </span>
          </button>
        </article>
      );
    })}
  </div>
);
