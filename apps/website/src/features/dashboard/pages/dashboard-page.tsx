import { useState } from "react";

import { ContentPage } from "@/components/content-page.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { authClient } from "@/features/auth/auth-client.ts";
import { PracticeSetupDialog } from "@/features/flashcards/components/practice-setup-dialog.tsx";
import { useDashboard } from "../api/dashboard-queries.ts";
import { DashboardContinue } from "../components/dashboard-library.tsx";
import { DashboardOnboarding } from "../components/dashboard-onboarding.tsx";
import { DashboardReviewQueue } from "../components/dashboard-review-queue.tsx";
import { StoneCard } from "@/features/stone/components/stone-card.tsx";
import { getDashboardGreeting } from "../dashboard-copy.ts";
import { LoadError } from "@/components/empty-state.tsx";

const todayLabel = () =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    .format(new Date())
    .replace(/^./, (c) => c.toUpperCase());

/** The greeting and the date share one baseline: a quiet header, not a headline. */
const Greeting = ({ text }: { text: string }) => (
  <header className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
    <h1 className="page-title">{text}</h1>
    <p className="text-[0.9375rem] text-muted-foreground">{todayLabel()}</p>
  </header>
);

const DashboardSkeleton = () => (
  <ContentPage maxWidth="6xl">
    <Skeleton className="h-8 w-80 max-w-full" />
    <div className="mt-6 grid gap-5" aria-label="Carregando seu início">
      <Skeleton className="h-52 rounded-[var(--radius-panel)]" />
      <Skeleton className="h-72 rounded-[var(--radius-panel)]" />
    </div>
  </ContentPage>
);

/**
 * The home has two panels: today (what to study, beside the stone it moves) and what to pick up
 * again. Detailed rhythm lives in Estatísticas; the stone already shows the week.
 */
export const DashboardPage = () => {
  const { data: session } = authClient.useSession();
  const dashboard = useDashboard();
  const [practiceCollectionId, setPracticeCollectionId] = useState<string | null>(null);

  if (dashboard.isPending) return <DashboardSkeleton />;
  if (dashboard.isError)
    return (
      <ContentPage maxWidth="6xl">
        <LoadError
          className="min-h-[55vh]"
          description="Seus materiais continuam seguros. Tente carregar o resumo novamente."
          onRetry={() => void dashboard.refetch()}
          surface="inline"
          title="Não foi possível carregar seu início"
        />
      </ContentPage>
    );

  const data = dashboard.data;
  const completedOnboardingSteps = data.onboarding.steps.filter(
    ({ completed }) => completed,
  ).length;
  const onboardingFirst = data.onboarding.visible && completedOnboardingSteps === 0;
  const hasReviewQueue = Boolean(
    data.reviewQueue.collections.length ||
    data.reviewQueue.nextReviewAt ||
    data.reviewQueue.totalDueReviews ||
    data.reviewQueue.totalNewCards,
  );
  const onboardingIsPrimary = data.onboarding.visible && (onboardingFirst || !hasReviewQueue);

  return (
    <ContentPage maxWidth="6xl">
      <Greeting text={getDashboardGreeting(session?.user.name ?? "", new Date().getHours())} />

      <div className="mt-6 grid gap-5">
        {onboardingIsPrimary && <DashboardOnboarding onboarding={data.onboarding} />}

        <section
          aria-label="Hoje"
          className="surface-panel grid lg:grid-cols-[minmax(0,1fr)_minmax(24rem,28rem)]"
        >
          <DashboardReviewQueue
            onStartPractice={setPracticeCollectionId}
            queue={data.reviewQueue}
          />
          {/* Centred in its cell, so the stone never leaves a gap under itself. */}
          <div className="flex items-center p-6 pt-2 lg:border-l lg:border-[var(--line-subtle)] lg:pt-6">
            <div className="w-full">
              <StoneCard />
            </div>
          </div>
        </section>

        {!onboardingIsPrimary && data.onboarding.visible && (
          <DashboardOnboarding onboarding={data.onboarding} />
        )}

        <DashboardContinue documents={data.recentDocuments} quizzes={data.quizContinuations} />
      </div>

      {practiceCollectionId && (
        <PracticeSetupDialog
          collectionId={practiceCollectionId}
          onOpenChange={(open) => !open && setPracticeCollectionId(null)}
          open
        />
      )}
    </ContentPage>
  );
};

export default DashboardPage;
