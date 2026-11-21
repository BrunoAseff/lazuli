import type { QuizCollectionSummary } from "@lazuli/shared";
import { PlayIcon } from "@/components/icons.tsx";
import { useState } from "react";

import { StudyCollectionActions } from "@/components/study-collection-actions.tsx";
import {
  StudyCollectionCard,
  StudyCollectionNote,
  StudyStrip,
} from "@/components/study-collection-card.tsx";
import { StudyCollectionIdentity } from "@/components/study-collection-identity.tsx";
import { QuizCollectionMark } from "@/components/quiz-collection-mark.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import type { StudyCollectionAction } from "@/lib/study-actions.ts";
import { FavoriteButton } from "@/features/favorites/favorite-button.tsx";
import { QuizStartDialog } from "./quiz-start-dialog.tsx";

/** Outlined in the list: one filled action per screen. Without questions, it says why it waits. */
const QuizStartButton = ({
  onClick,
  title,
  totalQuestions,
}: {
  onClick: () => void;
  title: string;
  totalQuestions: number;
}) => {
  const button = (
    <Button
      aria-label={`Iniciar ${title}`}
      className="w-full sm:w-auto"
      disabled={totalQuestions === 0}
      onClick={onClick}
      size="sm"
      variant="outline"
    >
      <PlayIcon aria-hidden="true" className="-translate-y-px" /> Iniciar
    </Button>
  );
  if (totalQuestions) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex w-full sm:w-auto" tabIndex={0}>
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>
        Adicione uma questão à coleção antes de iniciar.
      </TooltipContent>
    </Tooltip>
  );
};

/** The latest attempt as a strip: right and wrong answers, in the shared strip tones. */
export const QuizCollectionStrip = ({ collection }: { collection: QuizCollectionSummary }) => (
  <StudyStrip
    emptyLabel={collection.totalQuestions === 0 ? "Nenhuma questão ainda" : "Ainda não realizado"}
    label={
      collection.lastScore
        ? `Última tentativa: ${collection.lastScore.correctAnswers} de ${collection.lastScore.totalQuestions} corretas`
        : "Nenhuma tentativa concluída"
    }
    noun={{ singular: "questão", plural: "questões" }}
    segments={
      collection.lastScore
        ? [
            {
              count: collection.lastScore.correctAnswers,
              label:
                collection.lastScore.correctAnswers === 1
                  ? "correta na última tentativa"
                  : "corretas na última tentativa",
              tone: "correct",
            },
            {
              count: collection.lastScore.totalQuestions - collection.lastScore.correctAnswers,
              // The strip shows the latest attempt; when it is the only segment it must say so,
              // or it reads as contradicting "melhor resultado".
              label: `${
                collection.lastScore.totalQuestions - collection.lastScore.correctAnswers === 1
                  ? "errada"
                  : "erradas"
              }${collection.lastScore.correctAnswers ? "" : " na última tentativa"}`,
              tone: "incorrect",
            },
          ]
        : []
    }
  />
);

export const QuizCollectionList = ({
  collections,
  onAction,
  query,
}: {
  collections: QuizCollectionSummary[];
  onAction: (action: StudyCollectionAction, collection: QuizCollectionSummary) => void;
  query: string;
}) => {
  // Starting opens the dialog here, over the list: never through the editor, where answers show.
  const [starting, setStarting] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {collections.map((collection) => (
        <StudyCollectionCard
          favorite={<FavoriteButton kind="quizzes" id={collection.id} title={collection.title} />}
          actions={
            <>
              {!collection.archivedAt && (
                <QuizStartButton
                  onClick={() => setStarting(collection.id)}
                  title={collection.title}
                  totalQuestions={collection.totalQuestions}
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
              href={`/quizzes/${collection.id}`}
              icon={<QuizCollectionMark />}
              metadata={collection.project?.title ?? "Sem projeto"}
              projectTitle={collection.project?.title}
              query={query}
              title={collection.title}
            />
          }
          key={collection.id}
        >
          <QuizCollectionStrip collection={collection} />
          <StudyCollectionNote>
            {`${collection.totalQuestions} ${collection.totalQuestions === 1 ? "questão" : "questões"}`}
            {collection.bestScoreRate !== null &&
              ` · melhor resultado ${Math.round(collection.bestScoreRate * 100)}%`}
          </StudyCollectionNote>
        </StudyCollectionCard>
      ))}
      {starting && (
        <QuizStartDialog
          collectionId={starting}
          open
          onOpenChange={(open) => !open && setStarting(null)}
        />
      )}
    </div>
  );
};
