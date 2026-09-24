import type { QuizCollectionSummary } from "@lazuli/shared";
import {
  BarChart3Icon,
  CalendarClockIcon,
  SquareCheckBig,
  HistoryIcon,
  PlayIcon,
} from "lucide-react";
import { Link } from "react-router";

import { StudyCollectionActions } from "@/components/study-collection-actions.tsx";
import { StudyCollectionIdentity } from "@/components/study-collection-identity.tsx";
import { QuizCollectionMark } from "@/components/quiz-collection-mark.tsx";
import { Button } from "@/components/ui/button.tsx";
import { formatMediumDateTime } from "@/lib/date-format.ts";

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
  onAction: (
    action: "archive" | "delete" | "edit" | "restore",
    collection: QuizCollectionSummary,
  ) => void;
  query: string;
}) => (
  <div className="space-y-2">
    {collections.map((collection) => (
      <article
        className="relative grid gap-4 rounded-xl border bg-card px-4 py-4 transition-colors hover:bg-accent/45 sm:px-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(7rem,0.45fr)_minmax(10rem,0.7fr)_minmax(10rem,0.7fr)_minmax(7rem,auto)] lg:items-center"
        key={collection.id}
      >
        <div className="min-w-0 pr-10 lg:pr-0">
          <StudyCollectionIdentity
            href={`/quizzes/${collection.id}`}
            icon={<QuizCollectionMark />}
            metadata={collection.project?.title ?? "Sem projeto"}
            projectTitle={collection.project?.title}
            query={query}
            title={collection.title}
          />
        </div>

        <div className="flex items-center gap-2 text-sm">
          <SquareCheckBig aria-hidden="true" className="size-4 text-muted-foreground" />
          <span>
            {collection.totalQuestions} {collection.totalQuestions === 1 ? "questão" : "questões"}
          </span>
        </div>

        <div className="grid gap-1 text-sm">
          <p className="flex items-center gap-2">
            <HistoryIcon aria-hidden="true" className="size-4 text-muted-foreground" />
            <span>
              {collection.totalAttempts}{" "}
              {collection.totalAttempts === 1 ? "tentativa" : "tentativas"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {collection.lastAttemptAt
              ? `Última em ${formatMediumDateTime(collection.lastAttemptAt)}`
              : "Nenhuma tentativa concluída"}
          </p>
        </div>

        <div className="grid gap-1 text-sm">
          <p className="flex items-center gap-2">
            <BarChart3Icon aria-hidden="true" className="size-4 text-muted-foreground" />
            <span>Última: {scoreLabel(collection.lastScore)}</span>
          </p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarClockIcon aria-hidden="true" className="size-4" />
            <span>
              {collection.bestScoreRate === null
                ? "Sem melhor pontuação"
                : `Melhor: ${Math.round(collection.bestScoreRate * 100)}%`}
            </span>
          </p>
        </div>

        <div className="flex w-full items-center justify-end gap-2 lg:min-w-28">
          {!collection.archivedAt && (
            <Button
              asChild
              className="w-full lg:w-auto"
              size="sm"
              variant={collection.totalQuestions ? "default" : "secondary"}
            >
              <Link
                aria-disabled={collection.totalQuestions === 0}
                className={
                  collection.totalQuestions === 0 ? "pointer-events-none opacity-50" : undefined
                }
                to={`/quizzes/${collection.id}?start=true`}
              >
                <PlayIcon /> Iniciar
              </Link>
            </Button>
          )}
          <div className="absolute top-3 right-3 lg:static">
            <StudyCollectionActions
              archived={Boolean(collection.archivedAt)}
              onArchive={() => onAction("archive", collection)}
              onDelete={() => onAction("delete", collection)}
              onEdit={() => onAction("edit", collection)}
              onRestore={() => onAction("restore", collection)}
              title={collection.title}
            />
          </div>
        </div>
      </article>
    ))}
  </div>
);
