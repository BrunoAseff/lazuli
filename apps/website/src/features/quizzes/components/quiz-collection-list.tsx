import type { QuizCollectionSummary } from "@lazuli/shared";
import { BarChart3Icon, SquareCheckBig, HistoryIcon, PlayIcon } from "lucide-react";
import { Link } from "react-router";

import { StudyCollectionActions } from "@/components/study-collection-actions.tsx";
import { StudyCollectionCard, StudyCollectionMetric } from "@/components/study-collection-card.tsx";
import { StudyCollectionIdentity } from "@/components/study-collection-identity.tsx";
import { StudyCollectionOpenAction } from "@/components/study-collection-open-action.tsx";
import { QuizCollectionMark } from "@/components/quiz-collection-mark.tsx";
import { Button } from "@/components/ui/button.tsx";
import { formatMediumDateTime } from "@/lib/date-format.ts";
import type { StudyCollectionAction } from "@/lib/study-actions.ts";

const scoreLabel = (score: QuizCollectionSummary["lastScore"]) =>
  score
    ? `${score.correctAnswers} de ${score.totalQuestions} · ${Math.round(score.rate * 100)}%`
    : "Ainda não realizado";

export const QuizCollectionList = ({
  collections,
  onAction,
  query,
}: {
  collections: QuizCollectionSummary[];
  onAction: (action: StudyCollectionAction, collection: QuizCollectionSummary) => void;
  query: string;
}) => (
  <div className="space-y-2">
    {collections.map((collection) => (
      <StudyCollectionCard
        actions={
          <>
            <StudyCollectionOpenAction
              className={collection.archivedAt ? "col-span-2" : undefined}
              href={`/quizzes/${collection.id}`}
              title={collection.title}
            />
            {!collection.archivedAt && (
              <Button
                asChild={collection.totalQuestions > 0}
                className="w-full sm:w-auto"
                disabled={collection.totalQuestions === 0}
                size="sm"
                variant={collection.totalQuestions ? "default" : "secondary"}
              >
                {collection.totalQuestions > 0 ? (
                  <Link to={`/quizzes/${collection.id}?start=true`}>
                    <PlayIcon /> Iniciar
                  </Link>
                ) : (
                  <>
                    <PlayIcon /> Iniciar
                  </>
                )}
              </Button>
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
        <StudyCollectionMetric
          icon={<SquareCheckBig aria-hidden="true" className="size-4" />}
          label="Questões"
          value={`${collection.totalQuestions} ${collection.totalQuestions === 1 ? "questão" : "questões"}`}
        />
        <StudyCollectionMetric
          description={
            collection.lastAttemptAt
              ? `Última em ${formatMediumDateTime(collection.lastAttemptAt)}`
              : "Nenhuma tentativa concluída"
          }
          icon={<HistoryIcon aria-hidden="true" className="size-4" />}
          label="Tentativas"
          value={collection.totalAttempts}
        />
        <StudyCollectionMetric
          description={
            collection.bestScoreRate === null
              ? "Sem melhor pontuação"
              : `Melhor: ${Math.round(collection.bestScoreRate * 100)}%`
          }
          icon={<BarChart3Icon aria-hidden="true" className="size-4" />}
          label="Última pontuação"
          value={scoreLabel(collection.lastScore)}
        />
      </StudyCollectionCard>
    ))}
  </div>
);
