import type { FlashcardCollectionSummary } from "@lazuli/shared";

import { FlashcardCollectionMark } from "@/components/flashcard-collection-mark.tsx";
import { StudyCollectionActions } from "@/components/study-collection-actions.tsx";
import {
  StudyCollectionCard,
  StudyCollectionNote,
  StudyStrip,
  type StudyStripSegment,
} from "@/components/study-collection-card.tsx";
import { StudyCollectionIdentity } from "@/components/study-collection-identity.tsx";
import { StudyCollectionOpenAction } from "@/components/study-collection-open-action.tsx";
import { formatMediumDateTime } from "@/lib/date-format.ts";
import type { StudyCollectionAction } from "@/lib/study-actions.ts";
import { FlashcardPracticeButton } from "./flashcard-practice-button.tsx";
import { FavoriteButton } from "@/features/favorites/favorite-button.tsx";

/** New cards are always available, so reviews due now are the available cards that were studied before. */
export const memorySegments = (collection: FlashcardCollectionSummary): StudyStripSegment[] => {
  const due = Math.max(0, collection.dueCards - collection.newCards);
  const rest = Math.max(0, collection.totalCards - collection.newCards - due);
  return [
    { count: due, label: "para revisar", tone: "due" },
    { count: rest, label: "em dia", tone: "rest" },
    {
      count: collection.newCards,
      label: collection.newCards === 1 ? "novo" : "novos",
      tone: "new",
    },
  ];
};

export const memoryLabel = (collection: FlashcardCollectionSummary) => {
  const parts = memorySegments(collection)
    .filter(({ count }) => count > 0)
    .map(({ count, label }) => `${count} ${label}`);
  const next =
    collection.dueCards === 0 && collection.nextPracticeAt
      ? `; próxima prática em ${formatMediumDateTime(collection.nextPracticeAt)}`
      : "";
  return `Estado dos flashcards: ${parts.join(", ") || "nenhum flashcard"}${next}`;
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
      return (
        <StudyCollectionCard
          favorite={
            <FavoriteButton kind="flashcards" id={collection.id} title={collection.title} />
          }
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
                favoriteTarget={{ kind: "flashcards", id: collection.id }}
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
          <StudyStrip
            emptyLabel="Nenhum flashcard ainda"
            label={memoryLabel(collection)}
            noun={{ singular: "flashcard", plural: "flashcards" }}
            segments={memorySegments(collection)}
          />
          <StudyCollectionNote>
            {collection.dueCards === 0 && collection.nextPracticeAt
              ? `Próxima prática em ${formatMediumDateTime(collection.nextPracticeAt)}`
              : collection.reviewsLastSevenDays === 0
                ? "Sem revisões nos últimos 7 dias"
                : `${collection.reviewsLastSevenDays} ${
                    collection.reviewsLastSevenDays === 1 ? "revisão" : "revisões"
                  } nos últimos 7 dias`}
          </StudyCollectionNote>
        </StudyCollectionCard>
      );
    })}
  </div>
);
