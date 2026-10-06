import {
  documentContentSchema,
  flashcardContentSchema,
  quizQuestionContentSchema,
} from "@lazuli/shared";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { Database } from "../database/client.ts";
import { aiCreditAccount, project, studyMaterialReference } from "../database/schema/index.ts";
import { createOnboardingFixture, initializeNewUser } from "./onboarding-content.ts";

const userId = "onboarding-user";

describe("onboarding content", () => {
  it("builds stable, valid and realistic study content", () => {
    const first = createOnboardingFixture(userId);
    const second = createOnboardingFixture(userId);
    const anotherUser = createOnboardingFixture("another-user");

    expect(second).toEqual(first);
    expect(anotherUser.ids.project).not.toBe(first.ids.project);
    expect(z.uuid().safeParse(first.ids.project).success).toBe(true);
    expect(first.project.title).toBe("Exemplo: aprendendo a aprender");
    expect(documentContentSchema.safeParse(first.document.content).success).toBe(true);
    expect(first.document.contentByteSize).toBeGreaterThan(0);
    expect(first.flashcards).toHaveLength(2);
    expect(first.quizQuestions).toHaveLength(2);

    for (const card of first.flashcards) {
      expect(flashcardContentSchema.safeParse(card.question).success).toBe(true);
      expect(flashcardContentSchema.safeParse(card.answer).success).toBe(true);
      expect(card.questionText).not.toMatch(/exemplo de flashcard/i);
    }

    for (const question of first.quizQuestions) {
      expect(quizQuestionContentSchema.safeParse(question.content).success).toBe(true);
      expect(question.options).toHaveLength(4);
      expect(question.correctOptionIndex).toBeGreaterThanOrEqual(0);
      expect(question.correctOptionIndex).toBeLessThan(question.options.length);
      expect(new Set(question.options).size).toBe(question.options.length);
    }
  });

  it("stops after the deterministic project conflict instead of restoring removed content", async () => {
    const insertedTables: unknown[] = [];
    const tx = {
      insert: vi.fn((table: unknown) => ({
        values: vi.fn(() => {
          insertedTables.push(table);
          return {
            onConflictDoNothing: vi.fn(() =>
              table === project ? { returning: vi.fn(async () => []) } : Promise.resolve(undefined),
            ),
            onConflictDoUpdate: vi.fn(async () => undefined),
          };
        }),
      })),
    };
    const database = {
      transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    } as unknown as Database;

    await expect(initializeNewUser(database, userId)).resolves.toEqual({ created: false });
    expect(insertedTables).toEqual([aiCreditAccount, project]);
    expect(insertedTables).not.toContain(studyMaterialReference);
  });
});
