import {
  documentContentSchema,
  type DocumentBlock,
  flashcardContentSchema,
  quizQuestionContentSchema,
  utf8ByteLength,
} from "@lazuli/shared";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import {
  aiCreditAccount,
  document,
  flashcard,
  flashcardCollection,
  project,
  projectItem,
  quizCollection,
  quizOption,
  quizQuestion,
  studyMaterialReference,
  userStorage,
} from "../database/schema/index.ts";

const uuidFrom = (userId: string, name: string) => {
  const bytes = createHash("sha256")
    .update(`lazuli:onboarding:${userId}:${name}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const value = bytes.toString("hex");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
};

const textBlock = (
  id: string,
  text: string,
  options: { anchorId?: string; level?: number; type?: "heading" | "paragraph" } = {},
): DocumentBlock => ({
  id,
  type: options.type ?? "paragraph",
  props: options.level ? { level: options.level } : {},
  content: [
    {
      type: "text",
      text,
      styles: options.anchorId ? { sourceAnchor: options.anchorId } : {},
    },
  ],
  children: [],
});

const richText = (id: string, text: string) => flashcardContentSchema.parse([textBlock(id, text)]);

export const createOnboardingFixture = (userId: string) => {
  const ids = {
    project: uuidFrom(userId, "project"),
    document: uuidFrom(userId, "document"),
    activeRecallAnchor: uuidFrom(userId, "anchor:active-recall"),
    spacingAnchor: uuidFrom(userId, "anchor:spacing"),
    flashcardCollection: uuidFrom(userId, "flashcard-collection"),
    flashcardActiveRecall: uuidFrom(userId, "flashcard:active-recall"),
    flashcardSpacing: uuidFrom(userId, "flashcard:spacing"),
    quizCollection: uuidFrom(userId, "quiz-collection"),
    quizActiveRecall: uuidFrom(userId, "quiz:active-recall"),
    quizSpacing: uuidFrom(userId, "quiz:spacing"),
  };

  const documentContent = documentContentSchema.parse([
    textBlock(uuidFrom(userId, "block:title"), "Como estudar para lembrar", {
      level: 1,
      type: "heading",
    }),
    textBlock(
      uuidFrom(userId, "block:introduction"),
      "Aprender não depende apenas de reler. Recordar uma ideia sem consultar o material e voltar a ela em momentos diferentes tornam o estudo mais ativo.",
    ),
    textBlock(uuidFrom(userId, "block:active-recall-title"), "Recuperação ativa", {
      level: 2,
      type: "heading",
    }),
    textBlock(
      uuidFrom(userId, "block:active-recall"),
      "Recuperação ativa é tentar lembrar ou explicar uma informação antes de consultar a resposta. Esse esforço revela lacunas e fortalece o caminho usado para recuperar o conhecimento.",
      { anchorId: ids.activeRecallAnchor },
    ),
    textBlock(uuidFrom(userId, "block:spacing-title"), "Repetição espaçada", {
      level: 2,
      type: "heading",
    }),
    textBlock(
      uuidFrom(userId, "block:spacing"),
      "Repetição espaçada distribui as revisões ao longo do tempo. Em vez de concentrar tudo em uma sessão, o conteúdo retorna em intervalos crescentes conforme se torna mais fácil recordá-lo.",
      { anchorId: ids.spacingAnchor },
    ),
    textBlock(uuidFrom(userId, "block:cycle-title"), "Um ciclo simples", {
      level: 2,
      type: "heading",
    }),
    {
      ...textBlock(uuidFrom(userId, "block:cycle-one"), "Leia e organize a ideia principal."),
      type: "numberedListItem",
    },
    {
      ...textBlock(
        uuidFrom(userId, "block:cycle-two"),
        "Feche o material e tente recuperar a informação.",
      ),
      type: "numberedListItem",
    },
    {
      ...textBlock(
        uuidFrom(userId, "block:cycle-three"),
        "Revise novamente depois de algum tempo.",
      ),
      type: "numberedListItem",
    },
  ]);

  const flashcards = [
    {
      id: ids.flashcardActiveRecall,
      question: richText(
        uuidFrom(userId, "flashcard:active-recall:question"),
        "O que caracteriza a recuperação ativa?",
      ),
      answer: richText(
        uuidFrom(userId, "flashcard:active-recall:answer"),
        "Tentar lembrar ou explicar uma informação antes de consultar a resposta.",
      ),
      questionText: "O que caracteriza a recuperação ativa?",
      answerText: "Tentar lembrar ou explicar uma informação antes de consultar a resposta.",
    },
    {
      id: ids.flashcardSpacing,
      question: richText(
        uuidFrom(userId, "flashcard:spacing:question"),
        "Por que distribuir revisões ao longo do tempo?",
      ),
      answer: richText(
        uuidFrom(userId, "flashcard:spacing:answer"),
        "Porque reencontrar o conteúdo em intervalos crescentes fortalece sua recuperação.",
      ),
      questionText: "Por que distribuir revisões ao longo do tempo?",
      answerText:
        "Porque reencontrar o conteúdo em intervalos crescentes fortalece sua recuperação.",
    },
  ];

  const quizQuestions = [
    {
      id: ids.quizActiveRecall,
      content: quizQuestionContentSchema.parse([
        textBlock(
          uuidFrom(userId, "quiz:active-recall:content"),
          "Qual ação é um exemplo de recuperação ativa?",
        ),
      ]),
      contentText: "Qual ação é um exemplo de recuperação ativa?",
      options: [
        "Fechar as anotações e explicar o conceito com as próprias palavras",
        "Reler o mesmo parágrafo várias vezes seguidas",
        "Copiar integralmente o conteúdo para outra página",
        "Destacar todas as frases do texto",
      ],
      correctOptionIndex: 0,
    },
    {
      id: ids.quizSpacing,
      content: quizQuestionContentSchema.parse([
        textBlock(
          uuidFrom(userId, "quiz:spacing:content"),
          "Qual é o objetivo da repetição espaçada?",
        ),
      ]),
      contentText: "Qual é o objetivo da repetição espaçada?",
      options: [
        "Distribuir revisões em intervalos que aumentam conforme a lembrança melhora",
        "Concentrar todas as revisões em uma única sessão longa",
        "Evitar qualquer contato futuro com o conteúdo estudado",
        "Substituir a prática por uma releitura contínua",
      ],
      correctOptionIndex: 0,
    },
  ];

  return {
    ids,
    project: { id: ids.project, title: "Exemplo: aprendendo a aprender", coverKey: null },
    document: {
      id: ids.document,
      title: "Como estudar para lembrar",
      content: documentContent,
      contentByteSize: utf8ByteLength(JSON.stringify(documentContent)),
    },
    flashcardCollection: { id: ids.flashcardCollection, title: "Memória e aprendizagem" },
    flashcards,
    quizCollection: { id: ids.quizCollection, title: "Memória e aprendizagem" },
    quizQuestions,
  };
};

export const initializeNewUser = async (database: Database, userId: string) => {
  const fixture = createOnboardingFixture(userId);

  return database.transaction(async (tx) => {
    await tx.insert(aiCreditAccount).values({ userId }).onConflictDoNothing();

    const [createdProject] = await tx
      .insert(project)
      .values({ ...fixture.project, userId })
      .onConflictDoNothing({ target: project.id })
      .returning({ id: project.id });

    if (!createdProject) return { created: false as const };

    await tx.insert(projectItem).values({
      id: fixture.document.id,
      projectId: fixture.project.id,
      parentId: null,
      type: "document",
      title: fixture.document.title,
      position: 0,
    });
    await tx.insert(document).values({
      id: fixture.document.id,
      content: fixture.document.content,
      contentByteSize: fixture.document.contentByteSize,
    });
    await tx
      .insert(userStorage)
      .values({ userId, usedBytes: fixture.document.contentByteSize })
      .onConflictDoUpdate({
        target: userStorage.userId,
        set: {
          usedBytes: sql`${userStorage.usedBytes} + ${fixture.document.contentByteSize}`,
          updatedAt: new Date(),
        },
      });

    await tx.insert(flashcardCollection).values({
      ...fixture.flashcardCollection,
      userId,
      projectId: fixture.project.id,
    });
    await tx.insert(flashcard).values(
      fixture.flashcards.map((card) => ({
        ...card,
        collectionId: fixture.flashcardCollection.id,
      })),
    );

    await tx.insert(quizCollection).values({
      ...fixture.quizCollection,
      userId,
      projectId: fixture.project.id,
    });
    await tx.insert(quizQuestion).values(
      fixture.quizQuestions.map(({ content, contentText, id }, position) => ({
        id,
        collectionId: fixture.quizCollection.id,
        content,
        contentText,
        position,
      })),
    );
    await tx.insert(quizOption).values(
      fixture.quizQuestions.flatMap((question) =>
        question.options.map((text, position) => ({
          id: uuidFrom(userId, `quiz-option:${question.id}:${position}`),
          questionId: question.id,
          text,
          position,
          isCorrect: position === question.correctOptionIndex,
        })),
      ),
    );

    await tx.insert(studyMaterialReference).values([
      {
        id: uuidFrom(userId, "reference:flashcard:active-recall"),
        userId,
        documentId: fixture.document.id,
        anchorId: fixture.ids.activeRecallAnchor,
        flashcardId: fixture.ids.flashcardActiveRecall,
      },
      {
        id: uuidFrom(userId, "reference:flashcard:spacing"),
        userId,
        documentId: fixture.document.id,
        anchorId: fixture.ids.spacingAnchor,
        flashcardId: fixture.ids.flashcardSpacing,
      },
      {
        id: uuidFrom(userId, "reference:quiz:active-recall"),
        userId,
        documentId: fixture.document.id,
        anchorId: fixture.ids.activeRecallAnchor,
        quizQuestionId: fixture.ids.quizActiveRecall,
      },
      {
        id: uuidFrom(userId, "reference:quiz:spacing"),
        userId,
        documentId: fixture.document.id,
        anchorId: fixture.ids.spacingAnchor,
        quizQuestionId: fixture.ids.quizSpacing,
      },
    ]);

    return { created: true as const };
  });
};
