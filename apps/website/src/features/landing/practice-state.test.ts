import { describe, expect, it } from "vitest";

import { practiceFlashcards, practiceQuizQuestions } from "./practice-content.ts";
import {
  createFlashcardState,
  createQuizState,
  flashcardReducer,
  quizFeedback,
  quizReducer,
  quizScore,
  type FlashcardState,
  type PracticeRating,
  type QuizState,
} from "./practice-state.ts";

const rateCurrentCard = (state: FlashcardState, rating: PracticeRating) => {
  const cardId = state.queue[0]!;
  return flashcardReducer(flashcardReducer(state, { type: "reveal", cardId }), {
    type: "rate",
    cardId,
    rating,
  });
};

const select = (state: QuizState, index: number, optionIndex: number) =>
  quizReducer(quizReducer(state, { type: "navigate", index }), {
    type: "select",
    questionId: practiceQuizQuestions[index]!.id,
    optionIndex,
  });

const finishQuiz = (state: QuizState) =>
  quizReducer(quizReducer(state, { type: "review" }), { type: "complete" });

describe("public flashcard practice", () => {
  it("returns forgotten cards to the end without counting them as completed", () => {
    let state = rateCurrentCard(createFlashcardState(), "again");
    expect(state.queue).toEqual(["sunset-red", "sky-blue"]);
    expect(state.revealed).toBe(false);
    expect(practiceFlashcards.length - state.queue.length).toBe(0);

    state = rateCurrentCard(state, "hard");
    expect(state.queue).toEqual(["sky-blue"]);
    state = rateCurrentCard(state, "again");
    expect(state.queue).toEqual(["sky-blue"]);
    expect(state.revealed).toBe(false);
    expect(practiceFlashcards.length - state.queue.length).toBe(1);

    state = rateCurrentCard(state, "good");
    expect(state.queue).toEqual([]);
    expect(state.ratings).toEqual({ again: 2, hard: 1, good: 1, easy: 0 });
    expect(state.lastRating).toBe("good");
  });

  it("requires a separate reveal and ignores stale actions for another card", () => {
    const initial = createFlashcardState();
    expect(flashcardReducer(initial, { type: "rate", cardId: "sky-blue", rating: "easy" })).toBe(
      initial,
    );
    expect(flashcardReducer(initial, { type: "reveal", cardId: "sunset-red" })).toBe(initial);

    const next = rateCurrentCard(initial, "easy");
    const revealed = flashcardReducer(next, { type: "reveal", cardId: "sunset-red" });
    expect(flashcardReducer(revealed, { type: "rate", cardId: "sky-blue", rating: "easy" })).toBe(
      revealed,
    );
    expect(flashcardReducer(revealed, { type: "reveal", cardId: "sunset-red" })).toBe(revealed);
    expect(initial.queue).toEqual(["sky-blue", "sunset-red"]);
    expect(initial.ratings.easy).toBe(0);
  });

  it("keeps completed sessions stable and restarts without old evaluations", () => {
    const completed = rateCurrentCard(rateCurrentCard(createFlashcardState(), "easy"), "good");
    expect(flashcardReducer(completed, { type: "reveal", cardId: "sky-blue" })).toBe(completed);
    expect(
      flashcardReducer(completed, { type: "rate", cardId: "sunset-red", rating: "again" }),
    ).toBe(completed);
    expect(flashcardReducer(completed, { type: "restart" })).toEqual(createFlashcardState());
  });
});

describe("public quiz attempt", () => {
  it("keeps selections while navigating and allows corrections before completion", () => {
    const initial = createQuizState();
    let state = select(initial, 0, 2);
    state = select(state, 1, 1);
    state = quizReducer(state, { type: "review" });
    expect(state.answers).toEqual([2, 1]);
    expect(quizScore(state)).toBeNull();
    expect(quizFeedback(state, 0)).toBeNull();
    expect(quizFeedback(state, 1)).toBeNull();

    state = select(state, 0, 1);
    expect(state.phase).toBe("answering");
    expect(state.answers).toEqual([1, 1]);
    expect(initial.answers).toEqual([null, null]);
    expect(quizReducer(state, { type: "complete" })).toBe(state);

    state = finishQuiz(state);
    expect(state.phase).toBe("completed");
    expect(state.index).toBe(0);
    expect(quizScore(state)).toBe(1);
    expect(quizFeedback(state)).toMatchObject({ correct: true, selectedOptionIndex: 1 });
    expect(quizFeedback(state, 1)).toMatchObject({
      correct: false,
      selectedOptionIndex: 1,
      correctOptionIndex: 0,
      sourceIndex: 1,
    });
  });

  it("requires every answer and an explicit review before finishing", () => {
    const initial = createQuizState();
    expect(quizScore(initial)).toBeNull();
    expect(quizFeedback(initial)).toBeNull();
    expect(quizReducer(initial, { type: "complete" })).toBe(initial);
    const reviewingEmpty = quizReducer(initial, { type: "review" });
    expect(quizReducer(reviewingEmpty, { type: "complete" })).toBe(reviewingEmpty);

    const partial = select(initial, 0, 1);
    const reviewingPartial = quizReducer(partial, { type: "review" });
    expect(quizReducer(reviewingPartial, { type: "complete" })).toBe(reviewingPartial);
    expect(quizFeedback(reviewingPartial)).toBeNull();

    const answered = select(partial, 1, 0);
    expect(quizScore(answered)).toBeNull();
    expect(quizFeedback(answered)).toBeNull();
    expect(quizReducer(answered, { type: "complete" })).toBe(answered);
    expect(quizScore(finishQuiz(answered))).toBe(2);
  });

  it("locks completed answers while permitting result navigation and a fresh attempt", () => {
    const completed = finishQuiz(select(select(createQuizState(), 0, 1), 1, 0));
    expect(
      quizReducer(completed, { type: "select", questionId: "quiz-sky-blue", optionIndex: 2 }),
    ).toBe(completed);
    expect(quizReducer(completed, { type: "review" })).toBe(completed);
    const lastResult = quizReducer(completed, { type: "navigate", index: 1 });
    expect(lastResult.phase).toBe("completed");
    expect(quizFeedback(lastResult)?.sourceIndex).toBe(1);
    expect(quizScore(lastResult)).toBe(2);
    expect(quizReducer(lastResult, { type: "restart" })).toEqual(createQuizState());
  });

  it("ignores invalid navigation, options, stale question actions and review edits", () => {
    const initial = createQuizState();
    for (const index of [-1, 0.5, 2, Number.NaN]) {
      expect(quizReducer(initial, { type: "navigate", index })).toBe(initial);
    }
    for (const optionIndex of [-1, 0.5, 3, Number.NaN]) {
      expect(
        quizReducer(initial, { type: "select", questionId: "quiz-sky-blue", optionIndex }),
      ).toBe(initial);
    }
    expect(
      quizReducer(initial, { type: "select", questionId: "quiz-sunset-red", optionIndex: 0 }),
    ).toBe(initial);
    const reviewing = quizReducer(initial, { type: "review" });
    expect(
      quizReducer(reviewing, { type: "select", questionId: "quiz-sky-blue", optionIndex: 1 }),
    ).toBe(reviewing);
    const completed = finishQuiz(select(select(initial, 0, 1), 1, 0));
    expect(quizFeedback(completed, -1)).toBeNull();
    expect(quizFeedback(completed, 0.5)).toBeNull();
    expect(quizFeedback(completed, 2)).toBeNull();
  });
});
