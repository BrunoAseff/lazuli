import { useState } from "react";

import { ContentPage } from "@/components/content-page.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { authClient } from "@/features/auth/auth-client.ts";
import { PracticeSetupDialog } from "@/features/flashcards/components/practice-setup-dialog.tsx";
import { cn } from "@/lib/utils.ts";
import { useDashboard } from "../api/dashboard-queries.ts";
import {
  DashboardContinuations,
  DashboardRecentDocuments,
} from "../components/dashboard-library.tsx";
import { DashboardOnboarding } from "../components/dashboard-onboarding.tsx";
import { DashboardReviewQueue } from "../components/dashboard-review-queue.tsx";
import { DashboardWeeklyActivity } from "../components/dashboard-weekly-activity.tsx";
import { getDashboardGreeting } from "../dashboard-copy.ts";

const DashboardSkeleton = () => (
  <ContentPage maxWidth="6xl">
    <Skeleton className="h-12 w-72 max-w-full" />
    <div className="mt-10 space-y-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(18rem,5fr)] lg:gap-12">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(18rem,5fr)] lg:gap-12">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  </ContentPage>
);

export const DashboardPage = () => {
  const { data: session } = authClient.useSession();
  const dashboard = useDashboard();
  const [practiceCollectionId, setPracticeCollectionId] = useState<string | null>(null);

  if (dashboard.isPending) return <DashboardSkeleton />;
  if (dashboard.isError)
    return (
      <ContentPage maxWidth="6xl">
        <div className="grid min-h-[55vh] place-items-center text-center">
          <div className="max-w-md">
            <h1 className="font-heading text-3xl font-medium">
              Não foi possível carregar seu início
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Seus materiais continuam seguros. Tente carregar o resumo novamente.
            </p>
            <Button className="mt-5" onClick={() => void dashboard.refetch()}>
              Tentar novamente
            </Button>
          </div>
        </div>
      </ContentPage>
    );

  const data = dashboard.data;
  const completedOnboardingSteps = data.onboarding.steps.filter(
    ({ completed }) => completed,
  ).length;
  const onboardingFirst = data.onboarding.visible && completedOnboardingSteps === 0;
  const hasContinuations = data.quizContinuations.length > 0;
  const hasDocuments = data.recentDocuments.length > 0;
  const hasReviewQueue = Boolean(
    data.reviewQueue.collections.length ||
    data.reviewQueue.nextReviewAt ||
    data.reviewQueue.totalDueReviews ||
    data.reviewQueue.totalNewCards,
  );
  const onboardingIsPrimary = data.onboarding.visible && (onboardingFirst || !hasReviewQueue);
  const reviewIsPrimary = hasReviewQueue && !onboardingIsPrimary;
  const continuationBesideActivity = !onboardingIsPrimary && !reviewIsPrimary && hasContinuations;
  const hasTopCompanion = onboardingIsPrimary || reviewIsPrimary || continuationBesideActivity;
  const continuationInLibrary = hasContinuations && !continuationBesideActivity;

  return (
    <ContentPage maxWidth="6xl">
      <header>
        <h1 className="font-heading text-4xl font-medium tracking-tight sm:text-5xl">
          {getDashboardGreeting(session?.user.name ?? "", new Date().getHours())}
        </h1>
      </header>

      <div className="mt-10 space-y-8 sm:mt-12">
        <div
          className={cn(
            "grid items-stretch gap-8 lg:gap-12",
            hasTopCompanion &&
              (reviewIsPrimary
                ? "lg:grid-cols-[minmax(0,8fr)_minmax(18rem,4fr)]"
                : "lg:grid-cols-[minmax(0,7fr)_minmax(18rem,5fr)]"),
          )}
        >
          {onboardingIsPrimary && <DashboardOnboarding onboarding={data.onboarding} />}
          {reviewIsPrimary && (
            <DashboardReviewQueue
              onStartPractice={setPracticeCollectionId}
              queue={data.reviewQueue}
            />
          )}
          <DashboardWeeklyActivity activity={data.weeklyActivity} />
          {continuationBesideActivity && (
            <DashboardContinuations quizzes={data.quizContinuations} />
          )}
        </div>

        {onboardingIsPrimary && hasReviewQueue && (
          <DashboardReviewQueue
            onStartPractice={setPracticeCollectionId}
            queue={data.reviewQueue}
          />
        )}

        {reviewIsPrimary && data.onboarding.visible && (
          <DashboardOnboarding onboarding={data.onboarding} />
        )}

        {(hasDocuments || continuationInLibrary) && (
          <div
            className={cn(
              "grid items-stretch gap-8 lg:gap-12",
              hasDocuments &&
                continuationInLibrary &&
                "lg:grid-cols-[minmax(0,7fr)_minmax(18rem,5fr)]",
            )}
          >
            {hasDocuments && (
              <div className={cn("min-w-0", continuationInLibrary && "order-2 lg:order-1")}>
                <DashboardRecentDocuments documents={data.recentDocuments} />
              </div>
            )}
            {continuationInLibrary && (
              <div className={cn("min-w-0", hasDocuments && "order-1 lg:order-2")}>
                <DashboardContinuations quizzes={data.quizContinuations} />
              </div>
            )}
          </div>
        )}
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
