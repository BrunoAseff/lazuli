export const APP_NAME = "Lazúli";

export * from "./account-settings/account-settings-contracts.ts";
export * from "./favorites.ts";
export * from "./global-search.ts";
export * from "./analytics/analytics-contracts.ts";
export * from "./ai/ai-contracts.ts";
export * from "./auth/auth-constants.ts";
export * from "./billing/billing-contracts.ts";
export * from "./dashboard/dashboard-contracts.ts";
export * from "./documents/document-contracts.ts";
export * from "./documents/source-anchor.ts";
export * from "./flashcards/flashcard-contracts.ts";
export * from "./flashcards/flashcard-metrics.ts";
export * from "./projects/project-contracts.ts";
export * from "./quizzes/quiz-contracts.ts";
export * from "./references/reference-contracts.ts";
export * from "./references/reference-content.ts";
export * from "./study-collections/study-collection-contracts.ts";

export type ApiHealthResponse = {
  appName: typeof APP_NAME;
  status: "ok";
  timestamp: string;
};
