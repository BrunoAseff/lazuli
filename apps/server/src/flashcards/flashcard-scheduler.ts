import type { FlashcardRating, FlashcardSrsState } from "@lazuli/shared";
import { fsrs, Rating, State, type Card } from "ts-fsrs";

export const FLASHCARD_SCHEDULER_VERSION = "ts-fsrs@5.4.1";

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 36_500,
  enable_fuzz: false,
  enable_short_term: true,
});

const ratings = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
} as const;

const states = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
} as const;

const stateNames: Record<State, FlashcardSrsState> = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Review]: "review",
  [State.Relearning]: "relearning",
};

export type StoredSchedule = {
  dueAt: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  srsState: FlashcardSrsState;
  lastReviewedAt: Date | null;
};

const toCard = (value: StoredSchedule): Card => ({
  due: value.dueAt,
  stability: value.stability,
  difficulty: value.difficulty,
  elapsed_days: value.elapsedDays,
  scheduled_days: value.scheduledDays,
  learning_steps: value.learningSteps,
  reps: value.reps,
  lapses: value.lapses,
  state: states[value.srsState],
  last_review: value.lastReviewedAt ?? undefined,
});

const assertSchedule = (card: Card, now: Date) => {
  const numbers = [
    card.stability,
    card.difficulty,
    card.elapsed_days,
    card.scheduled_days,
    card.learning_steps,
    card.reps,
    card.lapses,
  ];
  if (numbers.some((value) => !Number.isFinite(value) || value < 0) || card.due < now)
    throw new Error("FSRS returned an invalid schedule");
};

const toStored = (card: Card): StoredSchedule => ({
  dueAt: card.due,
  stability: card.stability,
  difficulty: card.difficulty,
  elapsedDays: card.elapsed_days,
  scheduledDays: card.scheduled_days,
  learningSteps: card.learning_steps,
  reps: card.reps,
  lapses: card.lapses,
  srsState: stateNames[card.state],
  lastReviewedAt: card.last_review ?? null,
});

export const previewFlashcardRatings = (value: StoredSchedule, now: Date) => {
  const preview = scheduler.repeat(toCard(value), now);
  return (Object.keys(ratings) as FlashcardRating[]).map((rating) => {
    const card = preview[ratings[rating]].card;
    assertSchedule(card, now);
    return {
      rating,
      dueAt: card.due,
      intervalSeconds: Math.max(0, Math.round((card.due.getTime() - now.getTime()) / 1_000)),
    };
  });
};

export const scheduleFlashcardReview = (
  value: StoredSchedule,
  rating: FlashcardRating,
  now: Date,
) => {
  const result = scheduler.next(toCard(value), now, ratings[rating]);
  assertSchedule(result.card, now);
  return { schedule: toStored(result.card), log: result.log };
};
