import type { AiReviewFlashcard, AiReviewQuiz } from "./components/ai-proposal-review-list.tsx";

export type AiReviewSource = {
  documentId: string;
  documentTitle: string;
  projectId: string;
  projectTitle: string;
};

export type AiReviewSession = {
  flashcards: AiReviewFlashcard[];
  quizQuestions: AiReviewQuiz[];
  source: AiReviewSource;
};

const key = (operationId: string) => `lazuli:ai-review:${operationId}`;

export const readAiReviewSession = (operationId: string): AiReviewSession | null => {
  if (!operationId) return null;
  try {
    const value = window.sessionStorage.getItem(key(operationId));
    return value ? (JSON.parse(value) as AiReviewSession) : null;
  } catch {
    return null;
  }
};

export const writeAiReviewSession = (operationId: string, value: AiReviewSession) => {
  if (!operationId) return;
  window.sessionStorage.setItem(key(operationId), JSON.stringify(value));
};

export const clearAiReviewSession = (operationId: string) => {
  if (operationId) window.sessionStorage.removeItem(key(operationId));
};

export const updateAiReviewReference = ({
  blockId,
  kind,
  operationId,
  proposalId,
  quote,
  referenceIndex,
}: {
  blockId: string;
  kind: "flashcard" | "quizQuestion";
  operationId: string;
  proposalId: string;
  quote: string;
  referenceIndex: number;
}) => {
  const review = readAiReviewSession(operationId);
  if (!review) return false;
  const collection = kind === "flashcard" ? review.flashcards : review.quizQuestions;
  const proposal = collection.find(({ id }) => id === proposalId);
  if (!proposal || referenceIndex > proposal.references.length) return false;
  const reference = { scope: "selection" as const, blockId, quote };
  if (referenceIndex === proposal.references.length) proposal.references.push(reference);
  else proposal.references[referenceIndex] = reference;
  writeAiReviewSession(operationId, review);
  return true;
};
