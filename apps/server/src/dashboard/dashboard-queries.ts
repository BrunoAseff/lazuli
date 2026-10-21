import type { DashboardResponse, DashboardWeeklyDay } from "@lazuli/shared";
import {
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

const utcDay = (value: Date) => value.toISOString().slice(0, 10);

const dateKeyInTimeZone = (value: Date, timeZone: string) => {
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

const shiftDateKey = (date: string, days: number) => {
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
          or(isNull(flashcardCollection.projectId), eq(project.quotaExempt, false)),
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
          or(isNull(flashcardCollection.projectId), eq(project.quotaExempt, false)),
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
          or(isNull(flashcardCollection.projectId), eq(project.quotaExempt, false)),
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
      .where(and(eq(quizCollection.userId, userId), isNull(quizCollection.archivedAt)))
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
      .groupBy(flashcardActivityDay),
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
      .groupBy(quizActivityDay),
  ]);

  const [ownDocument, generationProgress, flashcardPractice, quizPractice, onboardingDismissal] =
    await Promise.all([
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
          approved:
            sql<boolean>`coalesce(bool_or(${aiGeneration.approvedItems} > 0), false)`.mapWith(
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
      database
        .select({ id: flashcardPracticeSession.id })
        .from(flashcardPracticeSession)
        .innerJoin(
          flashcardCollection,
          and(
            eq(flashcardCollection.id, flashcardPracticeSession.collectionId),
            eq(flashcardCollection.userId, userId),
          ),
        )
        .leftJoin(project, eq(project.id, flashcardCollection.projectId))
        .where(
          and(
            eq(flashcardPracticeSession.userId, userId),
            eq(flashcardPracticeSession.status, "completed"),
            or(isNull(flashcardCollection.projectId), eq(project.quotaExempt, false)),
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
        .leftJoin(project, eq(project.id, quizCollection.projectId))
        .where(
          and(
            eq(quizAttempt.userId, userId),
            eq(quizAttempt.status, "completed"),
            or(isNull(quizCollection.projectId), eq(project.quotaExempt, false)),
          ),
        )
        .limit(1),
      database.query.userDashboardOnboarding.findFirst({
        columns: { dismissedAt: true },
        where: eq(userDashboardOnboarding.userId, userId),
      }),
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
  const ownDocumentTarget = ownDocument[0];
  const generated = generation?.generated ?? false;
  const approved = generation?.approved ?? false;
  const practiced = Boolean(flashcardPractice[0] || quizPractice[0]);
  const steps: DashboardResponse["onboarding"]["steps"] = [
    { id: "create-document", completed: Boolean(ownDocumentTarget), href: "/documents" },
    {
      id: "generate-material",
      completed: generated,
      href: ownDocumentTarget
        ? `/documents/${ownDocumentTarget.projectId}/document/${ownDocumentTarget.documentId}`
        : "/documents",
    },
    {
      id: "approve-material",
      completed: approved,
      href: ownDocumentTarget
        ? `/documents/${ownDocumentTarget.projectId}/document/${ownDocumentTarget.documentId}`
        : "/documents",
    },
    {
      id: "complete-practice",
      completed: practiced,
      href: reviewQueue.collections.length ? "/flashcards" : "/quizzes",
    },
  ];
  return {
    ...content,
    reviewQueue,
    onboarding: {
      dismissedAt: onboardingDismissal?.dismissedAt.toISOString() ?? null,
      visible: !onboardingDismissal && steps.some(({ completed }) => !completed),
      steps,
    },
    weeklyActivity: buildWeeklyActivity(flashcardDays, quizDays, now, timeZone),
  };
};
