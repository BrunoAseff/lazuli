import { formatUpcoming } from "@/lib/date-format.ts";
import { ForwardLink } from "@/components/nav-link.tsx";
import type { DashboardResponse } from "@lazuli/shared";
import type { Ref } from "react";
import { CheckCircleIcon } from "@/components/icons.tsx";
import { Link } from "react-router";

import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { Button } from "@/components/ui/button.tsx";

type ReviewCollection = DashboardResponse["reviewQueue"]["collections"][number];

const flashcardCount = (count: number) => `${count} ${count === 1 ? "flashcard" : "flashcards"}`;

const reviewProgress = (reviewedCards: number, totalCards: number) =>
  `${reviewedCards} de ${flashcardCount(totalCards)} ${totalCards === 1 ? "revisado" : "revisados"}`;

const collectionStatus = (collection: ReviewCollection) => {
  const session = collection.activeSession;
  if (session) return reviewProgress(session.reviewedCards, session.totalCards);
  if (collection.dueReviews) return `${flashcardCount(collection.dueReviews)} para revisar`;
  return `${flashcardCount(collection.newCards)} ${collection.newCards === 1 ? "novo" : "novos"}`;
};

const collectionAction = (collection: ReviewCollection) =>
  collection.activeSession ? "Continuar" : collection.dueReviews > 0 ? "Revisar" : "Começar";

/**
 * What to study now. A section of the home's "today" panel (the panel draws the surface): a 14px
 * heading, then one row per collection with its name at 15px and one small action. Only the first
 * action is filled, so the next step is never in doubt.
 */
export const DashboardReviewQueue = ({
  onStartPractice,
  queue,
}: {
  onStartPractice: (collectionId: string) => void;
  queue: DashboardResponse["reviewQueue"];
}) => {
  const summary =
    queue.totalDueReviews > 0
      ? `${flashcardCount(queue.totalDueReviews)} para revisar hoje`
      : queue.totalNewCards > 0
        ? `${flashcardCount(queue.totalNewCards)} para conhecer`
        : null;
  return (
    <section aria-labelledby="dashboard-reviews-title" className="min-w-0 p-6">
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm leading-snug font-semibold" id="dashboard-reviews-title">
          {queue.collections.some(({ activeSession }) => activeSession)
            ? "Continue sua prática"
            : "Seu próximo estudo"}
        </h2>
        <ForwardLink className="shrink-0" to="/flashcards">
          Ver coleções
        </ForwardLink>
      </header>
      {/* The total only adds information over two or more rows; with one, the row says it. */}
      {summary && queue.collections.length > 1 && (
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">{summary}</p>
      )}

      {queue.collections.length ? (
        <ul className="mt-3 grid gap-1">
          {queue.collections.map((collection, index) => {
            const session = collection.activeSession;
            const variant = index === 0 ? "default" : "outline";
            const label = collectionAction(collection);
            return (
              // The name reads as text; the action is a real button, with every button's hover,
              // press and focus.
              <li key={collection.collectionId} className="flex min-w-0 items-center gap-4 py-2">
                <span className="min-w-0 flex-1">
                  <OverflowTooltip text={collection.collectionTitle}>
                    {(ref) => (
                      <span
                        className="block truncate text-[0.9375rem] font-medium"
                        ref={ref as Ref<HTMLSpanElement>}
                      >
                        {collection.collectionTitle}
                      </span>
                    )}
                  </OverflowTooltip>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {collectionStatus(collection)}
                  </span>
                </span>
                {session ? (
                  <Button asChild size="sm" variant={variant}>
                    <Link
                      aria-label={`${label}: ${collection.collectionTitle}`}
                      to={`/flashcards/${collection.collectionId}/practice/${session.sessionId}`}
                    >
                      {label}
                    </Link>
                  </Button>
                ) : (
                  <Button
                    aria-label={`${label}: ${collection.collectionTitle}`}
                    onClick={() => onStartPractice(collection.collectionId)}
                    size="sm"
                    variant={variant}
                  >
                    {label}
                  </Button>
                )}
              </li>
            );
          })}
          {queue.hiddenCollectionCount > 0 && (
            <li className="pt-1 text-[0.8125rem] text-muted-foreground">
              {queue.hiddenCollectionCount === 1
                ? "Mais 1 coleção disponível"
                : `Mais ${queue.hiddenCollectionCount} coleções disponíveis`}
            </li>
          )}
        </ul>
      ) : (
        <div className="mt-4 flex items-start gap-3">
          <CheckCircleIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          <div>
            <p className="text-[0.9375rem] font-medium">Tudo revisado por aqui</p>
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
              {queue.nextReviewAt
                ? `Próxima revisão: ${formatUpcoming(queue.nextReviewAt)}.`
                : "Suas coleções aparecerão aqui quando houver flashcards disponíveis."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
