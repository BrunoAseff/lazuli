import {
  aiMaterialImprovementDraftSchema,
  type ApplyAiMaterialImprovementInput,
  type CreateAiMaterialImprovementInput,
} from "@lazuli/shared";
import { and, eq, or } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import {
  aiGeneration,
  flashcard,
  flashcardCollection,
  quizCollection,
  quizOption,
  quizQuestion,
} from "../database/schema/index.ts";
import { summarizeRichContent } from "../documents/rich-content-summary.ts";
import { listReferences } from "../references/reference-queries.ts";

const targetType = (kind: CreateAiMaterialImprovementInput["kind"]) =>
  kind === "flashcard" ? "flashcard" : "quizQuestion";

export const prepareAiMaterialImprovement = async (
  db: Database,
  userId: string,
  input: CreateAiMaterialImprovementInput,
) => {
  if (input.kind === "flashcard") {
    const [card] = await db
      .select({
        answer: flashcard.answer,
        answerText: flashcard.answerText,
        question: flashcard.question,
        questionText: flashcard.questionText,
        updatedAt: flashcard.updatedAt,
      })
      .from(flashcard)
      .innerJoin(flashcardCollection, eq(flashcardCollection.id, flashcard.collectionId))
      .where(
        and(
          eq(flashcard.id, input.materialId),
          eq(flashcard.collectionId, input.collectionId),
          eq(flashcardCollection.userId, userId),
        ),
      )
      .limit(1);
    if (!card) return { kind: "not-found" as const };
    const references = await listReferences(db, userId, {
      page: 1,
      pageSize: 20,
      targetId: input.materialId,
      targetType: targetType(input.kind),
    });
    return { kind: "ok" as const, material: card, references: references.items };
  }

  const [question] = await db
    .select({
      content: quizQuestion.content,
      contentText: quizQuestion.contentText,
      updatedAt: quizQuestion.updatedAt,
    })
    .from(quizQuestion)
    .innerJoin(quizCollection, eq(quizCollection.id, quizQuestion.collectionId))
    .where(
      and(
        eq(quizQuestion.id, input.materialId),
        eq(quizQuestion.collectionId, input.collectionId),
        eq(quizCollection.userId, userId),
      ),
    )
    .limit(1);
  if (!question) return { kind: "not-found" as const };
  const [options, references] = await Promise.all([
    db
      .select({ id: quizOption.id, isCorrect: quizOption.isCorrect, text: quizOption.text })
      .from(quizOption)
      .where(eq(quizOption.questionId, input.materialId))
      .orderBy(quizOption.position, quizOption.id),
    listReferences(db, userId, {
      page: 1,
      pageSize: 20,
      targetId: input.materialId,
      targetType: targetType(input.kind),
    }),
  ]);
  return {
    kind: "ok" as const,
    material: { ...question, options },
    references: references.items,
  };
};

export const applyAiMaterialImprovement = async (
  db: Database,
  userId: string,
  operationId: string,
  input: ApplyAiMaterialImprovementInput,
) =>
  db.transaction(async (tx) => {
    const [requested] = await tx
      .select()
      .from(aiGeneration)
      .where(and(eq(aiGeneration.id, operationId), eq(aiGeneration.userId, userId)))
      .limit(1);
    if (!requested) return { kind: "not-found" as const };
    const rootId = requested.regenerationOfId ?? requested.id;
    const chain = await tx
      .select()
      .from(aiGeneration)
      .where(
        and(
          eq(aiGeneration.userId, userId),
          or(eq(aiGeneration.id, rootId), eq(aiGeneration.regenerationOfId, rootId)),
        ),
      )
      .for("update");
    const operation = chain.find(({ id }) => id === operationId);
    if (!operation || operation.type !== "material_improvement" || operation.status !== "succeeded")
      return { kind: "not-found" as const };
    if (chain.some(({ approvedItems }) => approvedItems > 0))
      return { kind: "already-approved" as const };
    if (operation.expiresAt && operation.expiresAt <= new Date())
      return { kind: "expired" as const };
    const draft = aiMaterialImprovementDraftSchema.parse({
      ...(operation.result as object),
      approved: false,
      consumedCredits: operation.consumedCredits,
    });
    if (draft.kind !== input.kind) return { kind: "invalid" as const };

    const updatedAt = new Date();
    if (input.kind === "flashcard" && draft.kind === "flashcard") {
      const question = summarizeRichContent(input.question);
      const answer = summarizeRichContent(input.answer);
      if (question.assetIds.length || answer.assetIds.length)
        return { kind: "invalid-assets" as const };
      const [updated] = await tx
        .update(flashcard)
        .set({
          question: input.question,
          answer: input.answer,
          questionText: question.text,
          answerText: answer.text,
          updatedAt,
        })
        .where(
          and(eq(flashcard.id, draft.materialId), eq(flashcard.collectionId, draft.collectionId)),
        )
        .returning({ id: flashcard.id });
      if (!updated) return { kind: "not-found" as const };
    } else if (input.kind === "quizQuestion" && draft.kind === "quizQuestion") {
      const content = summarizeRichContent(input.content);
      if (content.assetIds.length) return { kind: "invalid-assets" as const };
      const [updated] = await tx
        .update(quizQuestion)
        .set({ content: input.content, contentText: content.text, updatedAt })
        .where(
          and(
            eq(quizQuestion.id, draft.materialId),
            eq(quizQuestion.collectionId, draft.collectionId),
          ),
        )
        .returning({ id: quizQuestion.id });
      if (!updated) return { kind: "not-found" as const };
      await tx.delete(quizOption).where(eq(quizOption.questionId, draft.materialId));
      await tx.insert(quizOption).values(
        input.options.map((option, position) => ({
          ...option,
          position,
          questionId: draft.materialId,
          updatedAt,
        })),
      );
    } else return { kind: "invalid" as const };

    await tx
      .update(aiGeneration)
      .set({ approvedItems: 1 })
      .where(eq(aiGeneration.id, operation.id));
    return {
      kind: "ok" as const,
      materialId: draft.materialId,
      updatedAt: updatedAt.toISOString(),
    };
  });
