import { calculateFlashcardProgress, type FlashcardCollectionSummary } from "@lazuli/shared";
import { CalendarClockIcon, ChartNoAxesColumnIncreasingIcon, RotateCcwIcon } from "lucide-react";

import { FlashcardCollectionMark } from "@/components/flashcard-collection-mark.tsx";
import { StudyCollectionActions } from "@/components/study-collection-actions.tsx";
import { StudyCollectionCard, StudyCollectionMetric } from "@/components/study-collection-card.tsx";
import { StudyCollectionIdentity } from "@/components/study-collection-identity.tsx";
import { StudyCollectionOpenAction } from "@/components/study-collection-open-action.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { formatMediumDateTime } from "@/lib/date-format.ts";
import type { StudyCollectionAction } from "@/lib/study-actions.ts";
import { FlashcardPracticeButton } from "./flashcard-practice-button.tsx";

const practiceLabel = (collection: FlashcardCollectionSummary) => {
  if (collection.totalCards === 0) return "Sem prática agendada";
  if (collection.dueCards > 0)
    return `${collection.dueCards} ${
      collection.dueCards === 1 ? "card disponível" : "cards disponíveis"
    }`;
  return collection.nextPracticeAt
    ? `Próxima em ${formatMediumDateTime(collection.nextPracticeAt)}`
    : "Sem prática agendada";
};

export const FlashcardCollectionList = ({
  collections,
  onAction,
  onPractice,
  query,
}: {
  collections: FlashcardCollectionSummary[];
  onAction: (action: StudyCollectionAction, collection: FlashcardCollectionSummary) => void;
  onPractice: (collection: FlashcardCollectionSummary) => void;
  query: string;
}) => (
  <div className="space-y-2">
    {collections.map((collection) => {
      const progress = calculateFlashcardProgress(collection.studiedCards, collection.totalCards);
      return (
        <StudyCollectionCard
          actions={
            <>
              <StudyCollectionOpenAction
                className={collection.archivedAt ? "col-span-2" : undefined}
                href={`/flashcards/${collection.id}`}
                title={collection.title}
              />
              {!collection.archivedAt && (
                <FlashcardPracticeButton
                  dueCards={collection.dueCards}
                  onClick={() => onPractice(collection)}
                  title={collection.title}
                  totalCards={collection.totalCards}
                />
              )}
              <StudyCollectionActions
                archived={Boolean(collection.archivedAt)}
                onArchive={() => onAction("archive", collection)}
                onDelete={() => onAction("delete", collection)}
                onEdit={() => onAction("edit", collection)}
                onRestore={() => onAction("restore", collection)}
                title={collection.title}
              />
            </>
          }
          identity={
            <StudyCollectionIdentity
              href={`/flashcards/${collection.id}`}
              icon={<FlashcardCollectionMark />}
              metadata={collection.project?.title ?? "Sem projeto"}
              projectTitle={collection.project?.title}
              query={query}
              title={collection.title}
            />
          }
          key={collection.id}
        >
          <StudyCollectionMetric
            icon={<ChartNoAxesColumnIncreasingIcon aria-hidden="true" className="size-4" />}
            label="Progresso"
            value={
              <span className="flex items-center justify-between gap-3">
                <span>{progress}%</span>
                <span className="font-normal text-muted-foreground">
                  {collection.studiedCards} de {collection.totalCards} estudados
                </span>
              </span>
            }
          >
            <Progress
              aria-label={`${collection.studiedCards} de ${collection.totalCards} cards estudados`}
              value={progress}
            />
          </StudyCollectionMetric>
          <StudyCollectionMetric
            icon={<CalendarClockIcon aria-hidden="true" className="size-4" />}
            label="Próxima prática"
            value={practiceLabel(collection)}
          />
          <StudyCollectionMetric
            icon={<RotateCcwIcon aria-hidden="true" className="size-4" />}
            label="Últimos 7 dias"
            value={
              collection.reviewsLastSevenDays === 0
                ? "Sem revisões"
                : `${collection.reviewsLastSevenDays} ${
                    collection.reviewsLastSevenDays === 1 ? "revisão" : "revisões"
                  }`
            }
          />
        </StudyCollectionCard>
      );
    })}
  </div>
);
