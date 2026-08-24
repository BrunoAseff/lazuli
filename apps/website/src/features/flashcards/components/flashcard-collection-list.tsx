import { calculateFlashcardProgress, type FlashcardCollectionSummary } from "@lazuli/shared";
import { CalendarClockIcon, Layers3Icon, RotateCcwIcon } from "lucide-react";
import type { Ref } from "react";

import { HighlightText } from "@/components/highlight-text.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { FlashcardCollectionActions } from "./flashcard-collection-actions.tsx";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const practiceLabel = (collection: FlashcardCollectionSummary) => {
  if (collection.totalCards === 0) return "Sem prática agendada";
  if (collection.dueCards > 0)
    return `${collection.dueCards} ${collection.dueCards === 1 ? "card disponível" : "cards disponíveis"}`;
  return collection.nextPracticeAt
    ? `Próxima em ${dateFormatter.format(new Date(collection.nextPracticeAt))}`
    : "Sem prática agendada";
};

export const FlashcardCollectionList = ({
  collections,
  onAction,
  query,
}: {
  collections: FlashcardCollectionSummary[];
  onAction: (
    action: "archive" | "delete" | "edit" | "restore",
    collection: FlashcardCollectionSummary,
  ) => void;
  query: string;
}) => (
  <div className="divide-y border-y">
    {collections.map((collection) => {
      const progress = calculateFlashcardProgress(collection.studiedCards, collection.totalCards);
      return (
        <article
          className="grid gap-4 py-5 sm:px-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(12rem,0.8fr)_minmax(13rem,0.9fr)_auto] lg:items-center"
          key={collection.id}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Layers3Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <OverflowTooltip text={collection.title}>
                {(ref) => (
                  <h2
                    className="truncate font-heading text-xl font-medium"
                    ref={ref as Ref<HTMLHeadingElement>}
                  >
                    <HighlightText query={query} text={collection.title} />
                  </h2>
                )}
              </OverflowTooltip>
            </div>
            <OverflowTooltip text={collection.project?.title ?? "Sem projeto"}>
              {(ref) => (
                <Badge
                  className="mt-2 max-w-full"
                  ref={ref as Ref<HTMLSpanElement>}
                  variant="outline"
                >
                  <span className="truncate">{collection.project?.title ?? "Sem projeto"}</span>
                </Badge>
              )}
            </OverflowTooltip>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {collection.totalCards} {collection.totalCards === 1 ? "card" : "cards"}
              </span>
              <span>{progress}%</span>
            </div>
            <Progress
              aria-label={`${collection.studiedCards} de ${collection.totalCards} cards estudados`}
              value={progress}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {collection.studiedCards} de {collection.totalCards} estudados
            </p>
          </div>
          <div className="grid gap-2 text-sm">
            <p className="flex items-center gap-2">
              <CalendarClockIcon aria-hidden="true" className="size-4 text-muted-foreground" />
              <span>{practiceLabel(collection)}</span>
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <RotateCcwIcon aria-hidden="true" className="size-4" />
              <span>
                {collection.reviewsLastSevenDays === 0
                  ? "Sem revisões nos últimos 7 dias"
                  : `${collection.reviewsLastSevenDays} ${collection.reviewsLastSevenDays === 1 ? "revisão" : "revisões"} nos últimos 7 dias`}
              </span>
            </p>
          </div>
          <div className="justify-self-end lg:justify-self-auto">
            <FlashcardCollectionActions
              collection={collection}
              onArchive={() => onAction("archive", collection)}
              onDelete={() => onAction("delete", collection)}
              onEdit={() => onAction("edit", collection)}
              onRestore={() => onAction("restore", collection)}
            />
          </div>
        </article>
      );
    })}
  </div>
);
