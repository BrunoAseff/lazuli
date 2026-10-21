import type { DashboardResponse } from "@lazuli/shared";
import { CheckCircleIcon } from "@phosphor-icons/react/CheckCircle";
import { StackIcon } from "@phosphor-icons/react/Stack";
import { ArrowRightIcon } from "lucide-react";
import { Link } from "react-router";

import { FlashcardDomainIcon } from "@/components/domain-icons.ts";
import { DashboardSectionTitle } from "./dashboard-section-title.tsx";

type ReviewCollection = DashboardResponse["reviewQueue"]["collections"][number];

const nextReviewFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

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

export const DashboardReviewQueue = ({
  onStartPractice,
  queue,
}: {
  onStartPractice: (collectionId: string) => void;
  queue: DashboardResponse["reviewQueue"];
}) => {
  const activeSession = queue.collections.find(({ activeSession }) => activeSession)?.activeSession;

  return (
    <section
      aria-labelledby="dashboard-reviews-title"
      className="h-full overflow-hidden rounded-xl bg-muted/45"
    >
      <div className="grid h-full xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="min-w-0 p-5 sm:p-6">
          <DashboardSectionTitle
            icon={<FlashcardDomainIcon aria-hidden="true" className="size-6" weight="duotone" />}
            id="dashboard-reviews-title"
            title="Revisões"
          />

          {activeSession ? (
            <div className="mt-8">
              <p className="font-heading text-5xl leading-none tabular-nums sm:text-6xl">
                {activeSession.reviewedCards}
                <span className="text-2xl text-muted-foreground sm:text-3xl">
                  /{activeSession.totalCards}
                </span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                flashcards revisados nesta prática
              </p>
            </div>
          ) : queue.totalDueReviews > 0 ? (
            <div className="mt-8">
              <p className="font-heading text-6xl leading-none tabular-nums sm:text-7xl">
                {queue.totalDueReviews}
              </p>
              <p className="mt-2 text-base text-muted-foreground">
                {queue.totalDueReviews === 1
                  ? "flashcard para revisar hoje"
                  : "flashcards para revisar hoje"}
              </p>
            </div>
          ) : queue.totalNewCards > 0 ? (
            <div className="mt-8">
              <p className="font-heading text-6xl leading-none tabular-nums sm:text-7xl">
                {queue.totalNewCards}
              </p>
              <p className="mt-2 text-base text-muted-foreground">
                {queue.totalNewCards === 1
                  ? "flashcard novo para estudar"
                  : "flashcards novos para estudar"}
              </p>
            </div>
          ) : (
            <div className="mt-10">
              <p className="font-heading text-4xl leading-tight">Tudo revisado</p>
              {queue.nextReviewAt && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Próxima revisão em {nextReviewFormatter.format(new Date(queue.nextReviewAt))}.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="m-3 flex flex-col rounded-xl bg-background/60 p-5 sm:m-4 sm:p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-heading text-2xl font-medium">Coleções</h3>
            <Link
              className="inline-flex shrink-0 items-center gap-1 text-sm text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              to="/flashcards"
            >
              Ver todas
              <ArrowRightIcon aria-hidden="true" className="size-4" />
            </Link>
          </div>

          {queue.collections.length ? (
            <div className="mt-5 space-y-1">
              {queue.collections.map((collection) => {
                const session = collection.activeSession;
                const content = (
                  <>
                    <StackIcon
                      aria-hidden="true"
                      className="size-5 shrink-0 text-primary"
                      weight="duotone"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {collection.collectionTitle}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {collectionStatus(collection)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-normal text-primary">
                      {collectionAction(collection)}
                    </span>
                  </>
                );
                return session ? (
                  <Link
                    className="flex min-w-0 items-center gap-3 rounded-lg px-3 py-3 outline-none transition-colors hover:bg-card/70 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                    key={collection.collectionId}
                    to={`/flashcards/${collection.collectionId}/practice/${session.sessionId}`}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    className="flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-3 text-left outline-none transition-colors hover:bg-card/70 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                    key={collection.collectionId}
                    onClick={() => onStartPractice(collection.collectionId)}
                    type="button"
                  >
                    {content}
                  </button>
                );
              })}
              {queue.hiddenCollectionCount > 0 && (
                <p className="px-3 pt-3 text-sm text-muted-foreground">
                  {queue.hiddenCollectionCount === 1
                    ? "Mais 1 coleção disponível"
                    : `Mais ${queue.hiddenCollectionCount} coleções disponíveis`}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-muted/60 text-primary">
                <CheckCircleIcon aria-hidden="true" className="size-6" weight="duotone" />
              </span>
              <p className="mt-3 font-heading text-xl">Nada para revisar agora</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Suas coleções aparecerão aqui quando houver flashcards disponíveis.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
