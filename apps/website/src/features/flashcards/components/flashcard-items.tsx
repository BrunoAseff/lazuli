import type { FlashcardSummary } from "@lazuli/shared";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  BrainIcon,
  ImageIcon,
  MoreHorizontalIcon,
  MoveRightIcon,
  PencilIcon,
  RefreshCwIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import type { Ref } from "react";

import { HighlightText } from "@/components/highlight-text.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
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

export const FlashcardItems = ({
  cards,
  editable = true,
  mode,
  onAction,
  onEdit,
  onSelect,
  query,
  selected,
}: {
  cards: FlashcardSummary[];
  editable?: boolean;
  mode: "cards" | "table";
  onAction: (action: "archive" | "delete" | "move" | "restore", card: FlashcardSummary) => void;
  onEdit: (card: FlashcardSummary) => void;
  onSelect: (cardId: string, selected: boolean) => void;
  query: string;
  selected: Set<string>;
}) => (
  <div
    className={cn(
      mode === "cards" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "border-y divide-y",
    )}
  >
    {cards.map((card) => {
      const schedule = scheduleMeta(card);
      const ScheduleIcon = schedule.Icon;
      return (
        <article
          className={cn(
            "group relative min-w-0 bg-background transition-colors hover:bg-muted/45",
            mode === "cards"
              ? "flex min-h-56 flex-col border p-5"
              : "grid gap-3 py-4 sm:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] sm:items-center sm:px-3",
          )}
          key={card.id}
        >
          <Checkbox
            aria-label={`Selecionar flashcard: ${card.questionText}`}
            checked={selected.has(card.id)}
            className={mode === "cards" ? "absolute top-4 left-4" : undefined}
            onCheckedChange={(value) => onSelect(card.id, value === true)}
          />
          <button
            className={cn("min-w-0 text-left", mode === "cards" && "mt-7 mb-5")}
            disabled={!editable}
            onClick={() => onEdit(card)}
            type="button"
          >
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Pergunta
              {card.questionHasImage && (
                <ImageIcon aria-label="Pergunta com imagem" className="size-3.5" />
              )}
            </p>
            <OverflowTooltip text={card.questionText || "Pergunta com imagem"}>
              {(ref) => (
                <h2
                  className={cn(
                    "font-heading font-medium",
                    mode === "cards" ? "line-clamp-3 text-xl" : "truncate text-lg",
                  )}
                  ref={ref as Ref<HTMLHeadingElement>}
                >
                  <HighlightText query={query} text={card.questionText || "Pergunta com imagem"} />
                </h2>
              )}
            </OverflowTooltip>
          </button>
          <button
            className="min-w-0 text-left"
            disabled={!editable}
            onClick={() => onEdit(card)}
            type="button"
          >
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Resposta
              {card.answerHasImage && (
                <ImageIcon aria-label="Resposta com imagem" className="size-3.5" />
              )}
            </p>
            <OverflowTooltip text={card.answerText || "Resposta com imagem"}>
              {(ref) => (
                <p
                  className={cn(
                    "text-muted-foreground",
                    mode === "cards" ? "line-clamp-3" : "truncate",
                  )}
                  ref={ref as Ref<HTMLParagraphElement>}
                >
                  <HighlightText query={query} text={card.answerText || "Resposta com imagem"} />
                </p>
              )}
            </OverflowTooltip>
          </button>
          <div
            className={cn(
              "flex min-w-0 items-center gap-1.5 overflow-hidden text-xs text-muted-foreground",
              mode === "cards" && "mt-auto flex items-center justify-between pt-5",
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap">
              <ScheduleIcon
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground/80"
              />
              <OverflowTooltip text={schedule.label}>
                {(ref) => (
                  <span className="truncate" ref={ref as Ref<HTMLSpanElement>}>
                    {schedule.label}
                  </span>
                )}
              </OverflowTooltip>
            </span>
          </div>
          <div className={mode === "cards" ? "absolute top-3 right-3" : "justify-self-end"}>
            <CardActions card={card} onAction={onAction} onEdit={() => onEdit(card)} />
          </div>
        </article>
      );
    })}
  </div>
);

const CardActions = ({
  card,
  onAction,
  onEdit,
}: {
  card: FlashcardSummary;
  onAction: (action: "archive" | "delete" | "move" | "restore", card: FlashcardSummary) => void;
  onEdit: () => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        aria-label="Ações do flashcard"
        className="justify-self-end"
        size="icon-sm"
        variant="ghost"
      >
        <MoreHorizontalIcon aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {!card.archivedAt && (
        <>
          <DropdownMenuItem onSelect={onEdit}>
            <PencilIcon aria-hidden="true" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onAction("move", card)}>
            <MoveRightIcon aria-hidden="true" /> Mover
          </DropdownMenuItem>
        </>
      )}
      <DropdownMenuItem onSelect={() => onAction(card.archivedAt ? "restore" : "archive", card)}>
        {card.archivedAt ? (
          <ArchiveRestoreIcon aria-hidden="true" />
        ) : (
          <ArchiveIcon aria-hidden="true" />
        )}
        {card.archivedAt ? "Restaurar" : "Arquivar"}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onSelect={() => onAction("delete", card)}>
        <Trash2Icon aria-hidden="true" /> Excluir
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
