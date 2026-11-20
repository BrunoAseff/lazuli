import type { DashboardResponse, DashboardWeeklyDay } from "@lazuli/shared";
import {
  type AnyColumn,
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";

import type { Database } from "../database/client.ts";
import {
  aiGeneration,
  flashcard,
  flashcardCollection,
  flashcardPracticeSession,
  flashcardReview,
  project,
  projectItem,
  quizAttempt,
  quizAttemptItem,
  quizCollection,
  quizQuestion,
  userDashboardOnboarding,
  userStudyGoal,
} from "../database/schema/index.ts";

const RECENT_DOCUMENT_LIMIT = 4;
const CANDIDATE_LIMIT = 4;
const CONTINUATION_LIMIT = 2;
const DAY_MS = 24 * 60 * 60 * 1_000;

type ActiveFlashcardSession = {
  collectionId: string;
  collectionTitle: string;
  sessionId: string;
  reviewedCards: number;
  totalCards: number;
};

type ReviewCollection = {
  collectionId: string;
  collectionTitle: string;
  dueReviews: number;
  newCards: number;
  oldestDueAt: Date | null;
};

type ReviewTotals = {
  availableCollectionCount: number;
  nextReviewAt: Date | null;
  totalDueReviews: number;
  totalNewCards: number;
};

type ActiveQuizAttempt = {
  answeredQuestions: number;
  attemptId: string;
  collectionId: string;
  collectionTitle: string;
  totalQuestions: number;
};

type QuizCandidate = {
  collectionId: string;
  collectionTitle: string;
  lastAttemptAt: Date | null;
  totalQuestions: number;
};

type RecentDocument = {
  documentId: string;
  documentTitle: string;
  isExample: boolean;
  projectId: string;
  projectTitle: string;
  updatedAt: Date;
};

type DailyMetric = {
  date: string;
  successful: number;
  total: number;
};

/**
 * A collection of the person's own library: outside any project, or in a project that is not the
 * example (the example project is the one exempt from quotas). Joins `project` on the collection.
 */
const ownLibrary = (projectId: AnyColumn) => or(isNull(projectId), eq(project.quotaExempt, false));

const utcDay = (value: Date) => value.toISOString().slice(0, 10);

export const dateKeyInTimeZone = (value: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const shiftDateKey = (date: string, days: number) => {
  const [year, month, day] = date.split("-").map(Number);
  return utcDay(new Date(Date.UTC(year!, month! - 1, day!) + days * DAY_MS));
};

export const buildWeeklyActivity = (
  flashcardDays: DailyMetric[],
  quizDays: DailyMetric[],
  now: Date,
  timeZone = "UTC",
): DashboardResponse["weeklyActivity"] => {
  const today = dateKeyInTimeZone(now, timeZone);
  const flashcardByDay = new Map(flashcardDays.map((item) => [item.date, item]));
  const quizByDay = new Map(quizDays.map((item) => [item.date, item]));
  const days: DashboardWeeklyDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDateKey(today, index - 6);
    const flashcardMetric = flashcardByDay.get(date);
    const quizMetric = quizByDay.get(date);
    const flashcardReviews = flashcardMetric?.total ?? 0;
    const quizAnswers = quizMetric?.total ?? 0;
    return { date, flashcardReviews, quizAnswers, total: flashcardReviews + quizAnswers };
  });
  const flashcardTotal = flashcardDays.reduce((total, item) => total + item.total, 0);
  const flashcardSuccessful = flashcardDays.reduce((total, item) => total + item.successful, 0);
  const quizTotal = quizDays.reduce((total, item) => total + item.total, 0);
  const quizSuccessful = quizDays.reduce((total, item) => total + item.successful, 0);
  return {
    days,
    flashcardRecallRate: flashcardTotal ? flashcardSuccessful / flashcardTotal : null,
    quizAccuracyRate: quizTotal ? quizSuccessful / quizTotal : null,
    totalItems: days.reduce((total, item) => total + item.total, 0),
  };
};

export const buildReviewQueue = ({
  activeSessions,
  collections,
  totals,
}: {
  activeSessions: ActiveFlashcardSession[];
  collections: ReviewCollection[];
  totals: ReviewTotals;
}): DashboardResponse["reviewQueue"] => {
  const metricsByCollection = new Map(collections.map((item) => [item.collectionId, item]));
  const merged: DashboardResponse["reviewQueue"]["collections"] = activeSessions.map((session) => {
    const metrics = metricsByCollection.get(session.collectionId);
    return {
      collectionId: session.collectionId,
      collectionTitle: session.collectionTitle,
      dueReviews: metrics?.dueReviews ?? 0,
      newCards: metrics?.newCards ?? 0,
      oldestDueAt: metrics?.oldestDueAt?.toISOString() ?? null,
      activeSession: {
        sessionId: session.sessionId,
        reviewedCards: session.reviewedCards,
        totalCards: session.totalCards,
      },
    };
  });
  for (const collection of collections) {
    if (activeSessions.some(({ collectionId }) => collectionId === collection.collectionId))
      continue;
    merged.push({
      ...collection,
      oldestDueAt: collection.oldestDueAt?.toISOString() ?? null,
      activeSession: null,
    });
  }
  const visible = merged.slice(0, CANDIDATE_LIMIT);
  const displayedAvailable = visible.filter(
    ({ dueReviews, newCards }) => dueReviews > 0 || newCards > 0,
  ).length;
  return {
    totalDueReviews: totals.totalDueReviews,
    totalNewCards: totals.totalNewCards,
    nextReviewAt: totals.nextReviewAt?.toISOString() ?? null,
    availableCollectionCount: totals.availableCollectionCount,
    hiddenCollectionCount: Math.max(0, totals.availableCollectionCount - displayedAvailable),
    collections: visible,
  };
};

export const selectDashboardContent = ({
  activeQuizAttempts,
  quizCandidates,
  recentDocuments,
}: {
  activeQuizAttempts: ActiveQuizAttempt[];
  quizCandidates: QuizCandidate[];
  recentDocuments: RecentDocument[];
}): Pick<DashboardResponse, "quizContinuations" | "recentDocuments"> => {
  const activeQuizContinuations = activeQuizAttempts.map((attempt) => ({
    kind: "active" as const,
    ...attempt,
  }));
  const candidateQuizContinuations = quizCandidates
    .filter(
      ({ collectionId }) =>
        !activeQuizAttempts.some((attempt) => attempt.collectionId === collectionId),
    )
    .map((candidate) => ({
      kind: candidate.lastAttemptAt ? ("recent" as const) : ("untried" as const),
      ...candidate,
      lastAttemptAt: candidate.lastAttemptAt?.toISOString() ?? null,
    }));
  return {
    recentDocuments: recentDocuments.map((document) => ({
      ...document,
      updatedAt: document.updatedAt.toISOString(),
    })),
    quizContinuations: [...activeQuizContinuations, ...candidateQuizContinuations].slice(
      0,
      CONTINUATION_LIMIT,
    ),
  };
};

export const dismissDashboardOnboarding = async (
  database: Database,
  userId: string,
  now = new Date(),
) => {
  const [inserted] = await database
    .insert(userDashboardOnboarding)
    .values({ userId, dismissedAt: now })
    .onConflictDoNothing({ target: userDashboardOnboarding.userId })
    .returning({ dismissedAt: userDashboardOnboarding.dismissedAt });
  if (inserted) return inserted;
  const existing = await database.query.userDashboardOnboarding.findFirst({
    columns: { dismissedAt: true },
    where: eq(userDashboardOnboarding.userId, userId),
  });
  return existing ?? { dismissedAt: now };
};

export const getDashboard = async (
  database: Database,
  userId: string,
  timeZone = "UTC",
  now = new Date(),
): Promise<DashboardResponse> => {
  const today = dateKeyInTimeZone(now, timeZone);
  const activityStartDay = shiftDateKey(today, -6);
  const activityEndDay = shiftDateKey(today, 1);
  const activityStart = sql<Date>`(${activityStartDay}::date::timestamp at time zone ${timeZone})`;
  const activityEnd = sql<Date>`(${activityEndDay}::date::timestamp at time zone ${timeZone})`;
  const flashcardActivityDay = sql<string>`to_char(${flashcardReview.reviewedAt} at time zone ${timeZone}, 'YYYY-MM-DD')`;
  const quizActivityDay = sql<string>`to_char(${quizAttemptItem.answeredAt} at time zone ${timeZone}, 'YYYY-MM-DD')`;
  const relevantGenerationTypes = ["selection_generation", "collection_generation"] as const;
  const availableCard = lte(flashcard.dueAt, now);
  const dueReview = and(isNotNull(flashcard.lastReviewedAt), availableCard);
  const newCard = and(isNull(flashcard.lastReviewedAt), availableCard);
  const futureReview = and(isNotNull(flashcard.lastReviewedAt), gt(flashcard.dueAt, now));

  // Until the person has flashcards of their own, the example's are on the home page to practise.
  const [ownCard] = await database
    .select({ id: flashcard.id })
    .from(flashcard)
    .innerJoin(
      flashcardCollection,
      and(
        eq(flashcardCollection.id, flashcard.collectionId),
        eq(flashcardCollection.userId, userId),
        isNull(flashcardCollection.archivedAt),
      ),
    )
    .leftJoin(project, eq(project.id, flashcardCollection.projectId))
    .where(and(isNull(flashcard.archivedAt), ownLibrary(flashcardCollection.projectId)))
    .limit(1);
  const libraryScope = ownCard ? ownLibrary(flashcardCollection.projectId) : undefined;
  // Quizzes follow the same rule: the example's leave the home page once the person has their own.
  const [ownQuestion] = await database
    .select({ id: quizQuestion.id })
    .from(quizQuestion)
    .innerJoin(
      quizCollection,
      and(
        eq(quizCollection.id, quizQuestion.collectionId),
        eq(quizCollection.userId, userId),
        isNull(quizCollection.archivedAt),
      ),
    )
    .leftJoin(project, eq(project.id, quizCollection.projectId))
    .where(and(isNull(quizQuestion.archivedAt), ownLibrary(quizCollection.projectId)))
    .limit(1);
  const quizScope = ownCard || ownQuestion ? ownLibrary(quizCollection.projectId) : undefined;

  const [
    recentDocuments,
    activeFlashcardSessions,
    reviewCollections,
    reviewTotals,
    activeQuizAttempts,
    quizCandidates,
    flashcardDays,
    quizDays,
  ] = await Promise.all([
    database
      .select({
        documentId: projectItem.id,
        documentTitle: projectItem.title,
        isExample: project.quotaExempt,
        projectId: project.id,
        projectTitle: project.title,
        updatedAt: projectItem.updatedAt,
      })
      .from(projectItem)
      .innerJoin(project, and(eq(project.id, projectItem.projectId), eq(project.userId, userId)))
      .where(eq(projectItem.type, "document"))
      .orderBy(desc(projectItem.updatedAt), desc(projectItem.id))
      .limit(RECENT_DOCUMENT_LIMIT),
    database
      .select({
        collectionId: flashcardCollection.id,
        collectionTitle: flashcardCollection.title,
        sessionId: flashcardPracticeSession.id,
        reviewedCards: flashcardPracticeSession.reviewedCards,
        totalCards: flashcardPracticeSession.totalCards,
      })
      .from(flashcardPracticeSession)
      .innerJoin(
        flashcardCollection,
        and(
          eq(flashcardCollection.id, flashcardPracticeSession.collectionId),
          eq(flashcardCollection.userId, userId),
          isNull(flashcardCollection.archivedAt),
        ),
      )
      .leftJoin(project, eq(project.id, flashcardCollection.projectId))
      .where(
        and(
          eq(flashcardPracticeSession.userId, userId),
          eq(flashcardPracticeSession.status, "active"),
          libraryScope,
        ),
      )
      .orderBy(desc(flashcardPracticeSession.lastActivityAt), desc(flashcardPracticeSession.id))
      .limit(CANDIDATE_LIMIT),
    database
      .select({
        collectionId: flashcardCollection.id,
        collectionTitle: flashcardCollection.title,
        dueReviews:
          sql<number>`count(*) filter (where ${flashcard.lastReviewedAt} is not null)`.mapWith(
            Number,
          ),
        newCards: sql<number>`count(*) filter (where ${flashcard.lastReviewedAt} is null)`.mapWith(
          Number,
        ),
        oldestDueAt:
          sql<Date | null>`min(${flashcard.dueAt}) filter (where ${flashcard.lastReviewedAt} is not null)`.mapWith(
            flashcard.dueAt,
          ),
      })
      .from(flashcardCollection)
      .innerJoin(
        flashcard,
        and(
          eq(flashcard.collectionId, flashcardCollection.id),
          isNull(flashcard.archivedAt),
          lte(flashcard.dueAt, now),
        ),
      )
      .leftJoin(project, eq(project.id, flashcardCollection.projectId))
      .where(
        and(
          eq(flashcardCollection.userId, userId),
          isNull(flashcardCollection.archivedAt),
          libraryScope,
        ),
      )
      .groupBy(flashcardCollection.id)
      .orderBy(
        desc(sql`count(*) filter (where ${flashcard.lastReviewedAt} is not null) > 0`),
        sql`min(${flashcard.dueAt}) filter (where ${flashcard.lastReviewedAt} is not null) asc nulls last`,
        desc(sql`count(*) filter (where ${flashcard.lastReviewedAt} is not null)`),
        desc(sql`count(*) filter (where ${flashcard.lastReviewedAt} is null)`),
        desc(flashcardCollection.id),
      )
      .limit(CANDIDATE_LIMIT),
    database
      .select({
        availableCollectionCount:
          sql<number>`count(distinct ${flashcardCollection.id}) filter (where ${availableCard})`.mapWith(
            Number,
          ),
        nextReviewAt:
          sql<Date | null>`min(${flashcard.dueAt}) filter (where ${futureReview})`.mapWith(
            flashcard.dueAt,
          ),
        totalDueReviews: sql<number>`count(*) filter (where ${dueReview})`.mapWith(Number),
        totalNewCards: sql<number>`count(*) filter (where ${newCard})`.mapWith(Number),
      })
      .from(flashcardCollection)
      .leftJoin(
        flashcard,
        and(eq(flashcard.collectionId, flashcardCollection.id), isNull(flashcard.archivedAt)),
      )
      .leftJoin(project, eq(project.id, flashcardCollection.projectId))
      .where(
        and(
          eq(flashcardCollection.userId, userId),
          isNull(flashcardCollection.archivedAt),
          libraryScope,
        ),
      ),
    database
      .select({
        answeredQuestions: quizAttempt.answeredQuestions,
        attemptId: quizAttempt.id,
        collectionId: quizCollection.id,
        collectionTitle: quizCollection.title,
        totalQuestions: quizAttempt.totalQuestions,
      })
      .from(quizAttempt)
      .innerJoin(
        quizCollection,
        and(
          eq(quizCollection.id, quizAttempt.collectionId),
          eq(quizCollection.userId, userId),
          isNull(quizCollection.archivedAt),
        ),
      )
      .where(and(eq(quizAttempt.userId, userId), eq(quizAttempt.status, "active")))
      .orderBy(desc(quizAttempt.lastActivityAt), desc(quizAttempt.id))
      .limit(CANDIDATE_LIMIT),
    database
      .select({
        collectionId: quizCollection.id,
        collectionTitle: quizCollection.title,
        lastAttemptAt: sql<Date | null>`max(${quizAttempt.completedAt})`.mapWith(
          quizAttempt.completedAt,
        ),
        totalQuestions: sql<number>`count(distinct ${quizQuestion.id})`.mapWith(Number),
      })
      .from(quizCollection)
      .innerJoin(
        quizQuestion,
        and(eq(quizQuestion.collectionId, quizCollection.id), isNull(quizQuestion.archivedAt)),
      )
      .leftJoin(
        quizAttempt,
        and(
          eq(quizAttempt.collectionId, quizCollection.id),
          eq(quizAttempt.userId, userId),
          eq(quizAttempt.status, "completed"),
        ),
      )
      .leftJoin(project, eq(project.id, quizCollection.projectId))
      .where(and(eq(quizCollection.userId, userId), isNull(quizCollection.archivedAt), quizScope))
      .groupBy(quizCollection.id)
      .orderBy(
        sql`max(${quizAttempt.completedAt}) is null desc`,
        sql`max(${quizAttempt.completedAt}) desc nulls last`,
        desc(quizCollection.updatedAt),
        desc(quizCollection.id),
      )
      .limit(CANDIDATE_LIMIT),
    database
      .select({
        date: flashcardActivityDay,
        successful:
          sql<number>`count(*) filter (where ${flashcardReview.rating} in ('hard', 'good', 'easy'))`.mapWith(
            Number,
          ),
        total: count().mapWith(Number),
      })
      .from(flashcardReview)
      .innerJoin(
        flashcardPracticeSession,
        and(
          eq(flashcardPracticeSession.id, flashcardReview.sessionId),
          eq(flashcardPracticeSession.userId, userId),
        ),
      )
      .where(
        and(
          gte(flashcardReview.reviewedAt, activityStart),
          lt(flashcardReview.reviewedAt, activityEnd),
        ),
      )
      .groupBy(sql`1`),
    database
      .select({
        date: quizActivityDay,
        successful:
          sql<number>`count(*) filter (where ${quizAttemptItem.isCorrect} = true)`.mapWith(Number),
        total: count().mapWith(Number),
      })
      .from(quizAttemptItem)
      .innerJoin(
        quizAttempt,
        and(eq(quizAttempt.id, quizAttemptItem.attemptId), eq(quizAttempt.userId, userId)),
      )
      .where(
        and(
          isNotNull(quizAttemptItem.answeredAt),
          gte(quizAttemptItem.answeredAt, activityStart),
          lt(quizAttemptItem.answeredAt, activityEnd),
        ),
      )
      .groupBy(sql`1`),
  ]);

  const [
    ownDocument,
    generationProgress,
    flashcardPractice,
    quizPractice,
    onboardingDismissal,
    exampleCollection,
    savedGoal,
  ] = await Promise.all([
    database
      .select({ documentId: projectItem.id, projectId: project.id })
      .from(projectItem)
      .innerJoin(
        project,
        and(
          eq(project.id, projectItem.projectId),
          eq(project.userId, userId),
          eq(project.quotaExempt, false),
        ),
      )
      .where(eq(projectItem.type, "document"))
      .orderBy(desc(projectItem.updatedAt), desc(projectItem.id))
      .limit(1),
    database
      .select({
        approved: sql<boolean>`coalesce(bool_or(${aiGeneration.approvedItems} > 0), false)`.mapWith(
          Boolean,
        ),
        generated: sql<boolean>`coalesce(bool_or(${aiGeneration.validItems} > 0), false)`.mapWith(
          Boolean,
        ),
      })
      .from(aiGeneration)
      .innerJoin(projectItem, sql`${aiGeneration.sourceIds}->>0 = ${projectItem.id}`)
      .innerJoin(
        project,
        and(
          eq(project.id, projectItem.projectId),
          eq(project.userId, userId),
          eq(project.quotaExempt, false),
        ),
      )
      .where(
        and(
          eq(aiGeneration.userId, userId),
          eq(aiGeneration.status, "succeeded"),
          inArray(aiGeneration.type, relevantGenerationTypes),
        ),
      ),
    // A finished practice of the example, over one of its collections or the whole project.
    database
      .select({ id: flashcardPracticeSession.id })
      .from(flashcardPracticeSession)
      .leftJoin(
        flashcardCollection,
        eq(flashcardCollection.id, flashcardPracticeSession.collectionId),
      )
      .innerJoin(
        project,
        and(
          sql`${project.id} = coalesce(${flashcardPracticeSession.projectId}, ${flashcardCollection.projectId})`,
          eq(project.userId, userId),
          eq(project.quotaExempt, true),
        ),
      )
      .where(
        and(
          eq(flashcardPracticeSession.userId, userId),
          eq(flashcardPracticeSession.status, "completed"),
        ),
      )
      .limit(1),
    database
      .select({ id: quizAttempt.id })
      .from(quizAttempt)
      .innerJoin(
        quizCollection,
        and(eq(quizCollection.id, quizAttempt.collectionId), eq(quizCollection.userId, userId)),
      )
      .innerJoin(
        project,
        and(eq(project.id, quizCollection.projectId), eq(project.quotaExempt, true)),
      )
      .where(and(eq(quizAttempt.userId, userId), eq(quizAttempt.status, "completed")))
      .limit(1),
    database.query.userDashboardOnboarding.findFirst({
      columns: { dismissedAt: true },
      where: eq(userDashboardOnboarding.userId, userId),
    }),
    database
      .select({ id: flashcardCollection.id })
      .from(flashcardCollection)
      .innerJoin(
        project,
        and(
          eq(project.id, flashcardCollection.projectId),
          eq(project.userId, userId),
          eq(project.quotaExempt, true),
        ),
      )
      .where(isNull(flashcardCollection.archivedAt))
      .limit(1),
    database
      .select({ userId: userStudyGoal.userId })
      .from(userStudyGoal)
      .where(eq(userStudyGoal.userId, userId))
      .limit(1),
  ]);

  const content = selectDashboardContent({
    activeQuizAttempts,
    quizCandidates,
    recentDocuments,
  });
  const reviewQueue = buildReviewQueue({
    activeSessions: activeFlashcardSessions,
    collections: reviewCollections,
    totals: reviewTotals[0] ?? {
      availableCollectionCount: 0,
      nextReviewAt: null,
      totalDueReviews: 0,
      totalNewCards: 0,
    },
  });
  const generation = generationProgress[0];
  const weeklyActivity = buildWeeklyActivity(flashcardDays, quizDays, now, timeZone);
  const ownDocumentTarget = ownDocument[0];
  const approved = generation?.approved ?? false;
  const example = exampleCollection[0];
  const ownDocumentHref = ownDocumentTarget
    ? `/documents/${ownDocumentTarget.projectId}/document/${ownDocumentTarget.documentId}`
    : "/documents";
  const steps: DashboardResponse["onboarding"]["steps"] = [
    {
      id: "practice-example",
      // Without the example (deleted), the step has nothing to ask.
      completed: Boolean(flashcardPractice[0] || quizPractice[0] || !example),
      href: example ? `/flashcards/${example.id}` : "/flashcards",
    },
    { id: "create-document", completed: Boolean(ownDocumentTarget), href: "/documents" },
    { id: "generate-material", completed: approved, href: ownDocumentHref },
    { id: "set-goal", completed: Boolean(savedGoal[0]), href: "/stone?meta=editar" },
  ];
  return {
    ...content,
    reviewQueue,
    onboarding: {
      dismissedAt: onboardingDismissal?.dismissedAt.toISOString() ?? null,
      visible: !onboardingDismissal && steps.some(({ completed }) => !completed),
      steps,
    },
    weeklyActivity,
  };
};
