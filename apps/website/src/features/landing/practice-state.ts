import { practiceFlashcards, practiceQuizQuestions, practiceRatings } from "./practice-content.ts";

export type PracticeRating = (typeof practiceRatings)[number]["value"];
export type PracticeCardId = (typeof practiceFlashcards)[number]["id"];

export type FlashcardState = {
  queue: PracticeCardId[];
  revealed: boolean;
  ratings: Record<PracticeRating, number>;
  lastRating: PracticeRating | null;
};

export type FlashcardAction =
  | { type: "reveal"; cardId: PracticeCardId }
  | { type: "rate"; cardId: PracticeCardId; rating: PracticeRating }
  | { type: "restart" };

export const createFlashcardState = (): FlashcardState => ({
  queue: practiceFlashcards.map(({ id }) => id),
  revealed: false,
  ratings: { again: 0, hard: 0, good: 0, easy: 0 },
  lastRating: null,
});

/** Like a real session, a forgotten card returns to the queue without completing it. */
export const flashcardReducer = (
  state: FlashcardState,
  action: FlashcardAction,
): FlashcardState => {
  if (action.type === "restart") return createFlashcardState();
  if (action.cardId !== state.queue[0]) return state;
  if (action.type === "reveal") return state.revealed ? state : { ...state, revealed: true };
  if (!state.revealed) return state;

  const remaining = state.queue.slice(1);
  return {
    queue: action.rating === "again" ? [...remaining, action.cardId] : remaining,
    revealed: false,
    ratings: { ...state.ratings, [action.rating]: state.ratings[action.rating] + 1 },
    lastRating: action.rating,
  };
};

export type QuizState = {
  phase: "answering" | "reviewing" | "completed";
  index: number;
  answers: Array<number | null>;
};

export type QuizAction =
  | { type: "select"; questionId: string; optionIndex: number }
  | { type: "navigate"; index: number }
  | { type: "review" }
  | { type: "complete" }
  | { type: "restart" };

export const createQuizState = (): QuizState => ({
  phase: "answering",
  index: 0,
  answers: practiceQuizQuestions.map(() => null),
});

export const quizReducer = (state: QuizState, action: QuizAction): QuizState => {
  if (action.type === "restart") return createQuizState();
  if (action.type === "navigate") {
    if (!Number.isInteger(action.index) || !practiceQuizQuestions[action.index]) return state;
    return {
      ...state,
      index: action.index,
      phase: state.phase === "completed" ? "completed" : "answering",
    };
  }
  if (state.phase === "completed") return state;
  if (action.type === "review") return { ...state, phase: "reviewing" };
  if (action.type === "complete") {
    return state.phase === "reviewing" && state.answers.every((answer) => answer !== null)
      ? { ...state, phase: "completed", index: 0 }
      : state;
  }

  const question = practiceQuizQuestions[state.index]!;
  if (
    state.phase !== "answering" ||
    action.questionId !== question.id ||
    !Number.isInteger(action.optionIndex) ||
    question.options[action.optionIndex] === undefined
  )
    return state;

  return {
    ...state,
    answers: state.answers.map((answer, index) =>
      index === state.index ? action.optionIndex : answer,
    ),
  };
};

/** Rendering should use these selectors to avoid correction before explicit completion. */
export const quizScore = (state: QuizState): number | null =>
  state.phase === "completed"
    ? state.answers.filter(
        (answer, index) => answer === practiceQuizQuestions[index]!.correctOptionIndex,
      ).length
    : null;

export type QuizFeedback = {
  selectedOptionIndex: number;
  correctOptionIndex: number;
  correct: boolean;
  explanation: string;
  sourceIndex: number;
};

export const quizFeedback = (
  state: QuizState,
  index: number = state.index,
): QuizFeedback | null => {
  if (state.phase !== "completed" || !Number.isInteger(index)) return null;
  const question = practiceQuizQuestions[index];
  const selectedOptionIndex = state.answers[index];
  if (!question || selectedOptionIndex === null || selectedOptionIndex === undefined) return null;
  return {
    selectedOptionIndex,
    correctOptionIndex: question.correctOptionIndex,
    correct: selectedOptionIndex === question.correctOptionIndex,
    explanation: question.explanation,
    sourceIndex: question.sourceIndex,
  };
};
