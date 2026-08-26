import type { QuizCollectionSummary } from "@lazuli/shared";
import {
  BarChart3Icon,
  CalendarClockIcon,
  SquareCheckBig,
  HistoryIcon,
  PlayIcon,
} from "lucide-react";
import type { Ref } from "react";
import { Link } from "react-router";

import { HighlightText } from "@/components/highlight-text.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { StudyCollectionActions } from "@/components/study-collection-actions.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});

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
  <div className="divide-y border-y">
    {collections.map((collection) => (
      <article
        className="grid gap-4 py-5 sm:px-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(9rem,0.55fr)_minmax(12rem,0.75fr)_minmax(12rem,0.75fr)_auto_auto] lg:items-center"
        key={collection.id}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SquareCheckBig aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <OverflowTooltip text={collection.title}>
              {(ref) => (
                <Link
                  className="truncate font-heading text-xl font-medium underline-offset-4 hover:underline"
                  ref={ref as Ref<HTMLAnchorElement>}
                  to={`/quizzes/${collection.id}`}
                >
                  <HighlightText query={query} text={collection.title} />
                </Link>
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
              ? `Última em ${dateFormatter.format(new Date(collection.lastAttemptAt))}`
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

        {!collection.archivedAt && (
          <Button asChild size="sm" variant={collection.totalQuestions ? "default" : "secondary"}>
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

        <StudyCollectionActions
          archived={Boolean(collection.archivedAt)}
          onArchive={() => onAction("archive", collection)}
          onDelete={() => onAction("delete", collection)}
          onEdit={() => onAction("edit", collection)}
          onRestore={() => onAction("restore", collection)}
          title={collection.title}
        />
      </article>
    ))}
  </div>
);
