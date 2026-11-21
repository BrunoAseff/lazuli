import { z } from "zod";

import { projectIdSchema } from "../projects/project-contracts.ts";
import {
  flashcardCollectionIdSchema,
  flashcardPracticeSessionIdSchema,
} from "../flashcards/flashcard-contracts.ts";
import { quizAttemptIdSchema, quizCollectionIdSchema } from "../quizzes/quiz-contracts.ts";

const nonnegativeMetricSchema = z.number().int().nonnegative();

export const dashboardRecentDocumentSchema = z.object({
  documentId: projectIdSchema,
  documentTitle: z.string(),
  projectId: projectIdSchema,
  projectTitle: z.string(),
  updatedAt: z.iso.datetime(),
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
  "practice-example",
  "create-document",
  "generate-material",
  "set-goal",
]);

export const dashboardOnboardingSchema = z.object({
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
  recentDocuments: z.array(dashboardRecentDocumentSchema).max(4),
  quizContinuations: z.array(dashboardQuizContinuationSchema).max(2),
});

export const dismissDashboardOnboardingSchema = z.object({ dismissed: z.literal(true) }).strict();

export const dashboardOnboardingDismissalSchema = z.object({
  dismissedAt: z.iso.datetime(),
});

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
export type DashboardOnboardingStepId = z.infer<typeof dashboardOnboardingStepIdSchema>;
