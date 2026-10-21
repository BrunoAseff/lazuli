import { z } from "zod";

import { projectIdSchema } from "../projects/project-contracts.ts";
import {
  flashcardCollectionIdSchema,
  flashcardPracticeSessionIdSchema,
} from "../flashcards/flashcard-contracts.ts";
import { quizAttemptIdSchema, quizCollectionIdSchema } from "../quizzes/quiz-contracts.ts";

const nonnegativeMetricSchema = z.number().int().nonnegative();

export const dashboardQuerySchema = z
  .object({ tz: z.string().trim().min(1).max(100).optional() })
  .strict();

export const dashboardRecentDocumentSchema = z.object({
  documentId: projectIdSchema,
  documentTitle: z.string(),
  projectId: projectIdSchema,
  projectTitle: z.string(),
  updatedAt: z.iso.datetime(),
  isExample: z.boolean(),
});

const dashboardReviewSessionSchema = z.object({
  sessionId: flashcardPracticeSessionIdSchema,
  reviewedCards: nonnegativeMetricSchema,
  totalCards: nonnegativeMetricSchema,
});

export const dashboardReviewCollectionSchema = z.object({
  collectionId: flashcardCollectionIdSchema,
  collectionTitle: z.string(),
  dueReviews: nonnegativeMetricSchema,
  newCards: nonnegativeMetricSchema,
  oldestDueAt: z.iso.datetime().nullable(),
  activeSession: dashboardReviewSessionSchema.nullable(),
});

export const dashboardReviewQueueSchema = z.object({
  totalDueReviews: nonnegativeMetricSchema,
  totalNewCards: nonnegativeMetricSchema,
  nextReviewAt: z.iso.datetime().nullable(),
  availableCollectionCount: nonnegativeMetricSchema,
  hiddenCollectionCount: nonnegativeMetricSchema,
  collections: z.array(dashboardReviewCollectionSchema).max(4),
});

export const dashboardOnboardingStepIdSchema = z.enum([
  "create-document",
  "generate-material",
  "approve-material",
  "complete-practice",
]);

export const dashboardOnboardingSchema = z.object({
  dismissedAt: z.iso.datetime().nullable(),
  visible: z.boolean(),
  steps: z
    .array(
      z.object({
        id: dashboardOnboardingStepIdSchema,
        completed: z.boolean(),
        href: z.string().startsWith("/"),
      }),
    )
    .length(4),
});

export const dashboardWeeklyDaySchema = z.object({
  date: z.iso.date(),
  flashcardReviews: nonnegativeMetricSchema,
  quizAnswers: nonnegativeMetricSchema,
  total: nonnegativeMetricSchema,
});

export const dashboardWeeklyActivitySchema = z.object({
  days: z.array(dashboardWeeklyDaySchema).length(7),
  flashcardRecallRate: z.number().min(0).max(1).nullable(),
  quizAccuracyRate: z.number().min(0).max(1).nullable(),
  totalItems: nonnegativeMetricSchema,
});

export const dashboardQuizContinuationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("active"),
    collectionId: quizCollectionIdSchema,
    collectionTitle: z.string(),
    attemptId: quizAttemptIdSchema,
    answeredQuestions: nonnegativeMetricSchema,
    totalQuestions: nonnegativeMetricSchema,
  }),
  z.object({
    kind: z.enum(["untried", "recent"]),
    collectionId: quizCollectionIdSchema,
    collectionTitle: z.string(),
    totalQuestions: z.number().int().positive(),
    lastAttemptAt: z.iso.datetime().nullable(),
  }),
]);

export const dashboardResponseSchema = z.object({
  reviewQueue: dashboardReviewQueueSchema,
  onboarding: dashboardOnboardingSchema,
  weeklyActivity: dashboardWeeklyActivitySchema,
  recentDocuments: z.array(dashboardRecentDocumentSchema).max(4),
  quizContinuations: z.array(dashboardQuizContinuationSchema).max(2),
});

export const dismissDashboardOnboardingSchema = z.object({ dismissed: z.literal(true) }).strict();

export const dashboardOnboardingDismissalSchema = z.object({
  dismissedAt: z.iso.datetime(),
});

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
export type DashboardOnboardingStepId = z.infer<typeof dashboardOnboardingStepIdSchema>;
export type DashboardWeeklyDay = z.infer<typeof dashboardWeeklyDaySchema>;
