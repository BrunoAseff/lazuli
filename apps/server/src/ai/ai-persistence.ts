import { randomUUID } from "node:crypto";

export const createPersistedQuizOptions = (
  questionId: string,
  options: Array<{ isCorrect: boolean; text: string }>,
  updatedAt?: Date,
) =>
  options.map((option, position) => ({
    id: randomUUID(),
    isCorrect: option.isCorrect,
    text: option.text,
    position,
    questionId,
    ...(updatedAt ? { updatedAt } : {}),
  }));
