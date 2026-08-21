export const APP_NAME = "Lazúli";

export * from "./documents/document-contracts.ts";
export * from "./documents/source-anchor.ts";
export * from "./flashcards/flashcard-contracts.ts";
export * from "./flashcards/flashcard-metrics.ts";
export * from "./projects/project-contracts.ts";

export type ApiHealthResponse = {
  appName: typeof APP_NAME;
  status: "ok";
  timestamp: string;
};
