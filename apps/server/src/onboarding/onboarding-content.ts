import {
  documentContentSchema,
  type DocumentBlock,
  flashcardContentSchema,
  quizQuestionContentSchema,
  utf8ByteLength,
} from "@lazuli/shared";
import { createHash } from "node:crypto";

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
  options: {
    anchorId?: string;
    level?: number;
    type?: "heading" | "paragraph" | "numberedListItem";
  } = {},
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

/*
 * The example project: three short documents on how to study, and the flashcards and questions
 * made from them, each linked to the passage it came from. Real content, so practising it shows
 * the whole app: documents, sources, practice, quiz and the stone.
 */

type ExampleBlock = { kind: "h1" | "h2" | "p" | "li"; text: string; anchor?: string };

const exampleDocuments: Array<{ key: string; title: string; blocks: ExampleBlock[] }> = [
  {
    key: "recall",
    title: "Recuperação ativa",
    blocks: [
      { kind: "h1", text: "Recuperação ativa" },
      {
        kind: "p",
        text: "Reler dá a sensação de que você sabe. Tentar lembrar mostra se você sabe de verdade.",
      },
      { kind: "h2", text: "O que é" },
      {
        kind: "p",
        anchor: "definition",
        text: "Recuperação ativa é buscar uma informação na memória sem olhar o material: responder uma pergunta, explicar um conceito ou resolver um exercício antes de consultar a resposta.",
      },
      { kind: "h2", text: "O efeito do teste" },
      {
        kind: "p",
        anchor: "testing",
        text: "Pesquisas sobre o efeito do teste mostram que tentar lembrar fortalece a memória mais do que reler pelo mesmo tempo. O esforço de buscar a resposta torna a próxima lembrança mais fácil.",
      },
      {
        kind: "p",
        anchor: "feedback",
        text: "Errar faz parte. Conferir a resposta logo depois de tentar corrige o engano e mostra o que ainda falta estudar.",
      },
      { kind: "h2", text: "Como praticar" },
      { kind: "li", anchor: "steps", text: "Leia um trecho e feche o material." },
      { kind: "li", text: "Escreva ou diga o que lembra, com suas palavras." },
      { kind: "li", text: "Confira e marque o que faltou." },
      { kind: "li", text: "Transforme o que faltou em perguntas para revisar depois." },
    ],
  },
  {
    key: "spacing",
    title: "Repetição espaçada",
    blocks: [
      { kind: "h1", text: "Repetição espaçada" },
      {
        kind: "p",
        text: "Esquecer é normal. A questão é quando revisar para lembrar por mais tempo com menos esforço.",
      },
      { kind: "h2", text: "A curva do esquecimento" },
      {
        kind: "p",
        anchor: "forgetting",
        text: "Hermann Ebbinghaus mostrou, no fim do século XIX, que esquecemos rápido logo depois de aprender e mais devagar com o passar dos dias. Cada revisão deixa essa curva menos íngreme.",
      },
      { kind: "h2", text: "Intervalos que crescem" },
      {
        kind: "p",
        anchor: "intervals",
        text: "Na repetição espaçada, cada revisão acontece um pouco antes de você esquecer. Quando lembrar fica fácil, o intervalo até a próxima aumenta: um dia, depois alguns dias, depois semanas.",
      },
      {
        kind: "p",
        anchor: "cramming",
        text: "Estudar tudo de uma vez na véspera funciona para a prova do dia seguinte, mas o conteúdo se perde em poucos dias.",
      },
      { kind: "h2", text: "Como o Lazúli agenda" },
      {
        kind: "p",
        anchor: "scheduler",
        text: "Depois de cada flashcard, você diz como foi lembrar: Repetir, Difícil, Bom ou Fácil. O Lazúli usa essa resposta para marcar a próxima revisão. Um flashcard conta como dominado quando a próxima revisão fica a 21 dias ou mais.",
      },
    ],
  },
  {
    key: "interleaving",
    title: "Intercalar e elaborar",
    blocks: [
      { kind: "h1", text: "Intercalar e elaborar" },
      {
        kind: "p",
        text: "Duas estratégias simples deixam o estudo mais parecido com a prova: misturar assuntos e perguntar por quê.",
      },
      { kind: "h2", text: "Misturar assuntos" },
      {
        kind: "p",
        anchor: "interleaving",
        text: "Intercalar é alternar assuntos ou tipos de problema na mesma sessão, em vez de fazer um bloco inteiro de cada. Parece mais difícil, mas treina reconhecer qual estratégia usar, como acontece na prova.",
      },
      { kind: "h2", text: "Perguntar por quê" },
      {
        kind: "p",
        anchor: "elaboration",
        text: "Elaborar é explicar por que algo é verdade e como se liga ao que você já sabe. Perguntas como “por que isso acontece?” e “qual a diferença entre A e B?” criam mais caminhos até a mesma lembrança.",
      },
      { kind: "h2", text: "Um plano de estudo" },
      { kind: "li", anchor: "plan", text: "Leia e organize as ideias principais." },
      { kind: "li", text: "Crie perguntas sobre o que leu." },
      { kind: "li", text: "Pratique sem consultar e confira." },
      { kind: "li", text: "Revise nos dias que o Lazúli marcar, misturando assuntos." },
    ],
  },
];

const exampleFlashcards: Array<{
  key: string;
  document: string;
  anchor: string;
  question: string;
  answer: string;
}> = [
  {
    key: "recall-definition",
    document: "recall",
    anchor: "definition",
    question: "O que é recuperação ativa?",
    answer: "Buscar uma informação na memória sem olhar o material, antes de consultar a resposta.",
  },
  {
    key: "recall-testing",
    document: "recall",
    anchor: "testing",
    question: "O que diz o efeito do teste?",
    answer: "Que tentar lembrar fortalece a memória mais do que reler pelo mesmo tempo.",
  },
  {
    key: "recall-feedback",
    document: "recall",
    anchor: "feedback",
    question: "Errar ao tentar lembrar atrapalha o aprendizado?",
    answer: "Não. Conferir a resposta logo depois corrige o engano e mostra o que falta estudar.",
  },
  {
    key: "recall-steps",
    document: "recall",
    anchor: "steps",
    question: "Qual é o primeiro passo para praticar recuperação ativa com um texto?",
    answer: "Ler um trecho e fechar o material antes de tentar lembrar.",
  },
  {
    key: "spacing-forgetting",
    document: "spacing",
    anchor: "forgetting",
    question: "O que mostra a curva do esquecimento?",
    answer: "Que esquecemos rápido logo depois de aprender e mais devagar com o tempo.",
  },
  {
    key: "spacing-intervals",
    document: "spacing",
    anchor: "intervals",
    question: "Na repetição espaçada, quando acontece cada revisão?",
    answer:
      "Um pouco antes de você esquecer, com intervalos que crescem conforme lembrar fica fácil.",
  },
  {
    key: "spacing-cramming",
    document: "spacing",
    anchor: "cramming",
    question: "Qual é o problema de estudar tudo na véspera?",
    answer: "Funciona para a prova seguinte, mas o conteúdo se perde em poucos dias.",
  },
  {
    key: "spacing-mastered",
    document: "spacing",
    anchor: "scheduler",
    question: "Quando um flashcard conta como dominado no Lazúli?",
    answer: "Quando a próxima revisão fica a 21 dias ou mais.",
  },
  {
    key: "interleaving-definition",
    document: "interleaving",
    anchor: "interleaving",
    question: "O que é intercalar o estudo?",
    answer:
      "Alternar assuntos ou tipos de problema na mesma sessão, em vez de estudar um bloco de cada vez.",
  },
  {
    key: "interleaving-why",
    document: "interleaving",
    anchor: "interleaving",
    question: "Por que intercalar ajuda na prova?",
    answer: "Porque treina reconhecer qual estratégia usar em cada problema.",
  },
  {
    key: "elaboration-definition",
    document: "interleaving",
    anchor: "elaboration",
    question: "O que é elaboração?",
    answer: "Explicar por que algo é verdade e como se liga ao que você já sabe.",
  },
  {
    key: "elaboration-example",
    document: "interleaving",
    anchor: "elaboration",
    question: "Dê um exemplo de pergunta de elaboração.",
    answer: "“Por que isso acontece?” ou “qual a diferença entre A e B?”",
  },
];

const exampleQuestions: Array<{
  key: string;
  document: string;
  anchor: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
}> = [
  {
    key: "recall-practice",
    document: "recall",
    anchor: "definition",
    question: "Qual destas é uma prática de recuperação ativa?",
    options: [
      "Reler o capítulo destacando as frases importantes",
      "Explicar o conceito sem olhar e só depois conferir no texto",
      "Copiar o resumo do professor",
      "Assistir à aula de novo em velocidade maior",
    ],
    correctOptionIndex: 1,
  },
  {
    key: "recall-error",
    document: "recall",
    anchor: "feedback",
    question: "O que acontece quando você erra uma resposta e confere logo em seguida?",
    options: [
      "A memória do conteúdo enfraquece",
      "O conteúdo precisa ser relido do início",
      "O engano é corrigido e você vê o que falta estudar",
      "Nada muda em relação a não ter tentado",
    ],
    correctOptionIndex: 2,
  },
  {
    key: "spacing-interval",
    document: "spacing",
    anchor: "intervals",
    question: "O que acontece com o intervalo entre revisões quando lembrar fica fácil?",
    options: ["Ele aumenta", "Ele diminui", "Ele fica igual", "As revisões param"],
    correctOptionIndex: 0,
  },
  {
    key: "spacing-author",
    document: "spacing",
    anchor: "forgetting",
    question: "Quem descreveu a curva do esquecimento?",
    options: ["Jean Piaget", "Ivan Pavlov", "Sigmund Freud", "Hermann Ebbinghaus"],
    correctOptionIndex: 3,
  },
  {
    key: "interleaving-session",
    document: "interleaving",
    anchor: "interleaving",
    question: "Qual sessão de estudo usa intercalação?",
    options: [
      "Fazer 30 exercícios de frações e depois 30 de porcentagem",
      "Alternar exercícios de frações, porcentagem e equações",
      "Reler a teoria de frações três vezes",
      "Assistir a uma aula sobre equações",
    ],
    correctOptionIndex: 1,
  },
  {
    key: "elaboration-question",
    document: "interleaving",
    anchor: "elaboration",
    question: "Qual destas é uma pergunta de elaboração?",
    options: [
      "Por que a fotossíntese depende de luz?",
      "Em que ano foi a Proclamação da República?",
      "Qual é a fórmula da água?",
      "Quantas páginas tem o capítulo?",
    ],
    correctOptionIndex: 0,
  },
];

const blockType = {
  h1: { type: "heading", level: 1 },
  h2: { type: "heading", level: 2 },
  p: { type: "paragraph" },
  li: { type: "numberedListItem" },
} as const;

export const createOnboardingFixture = (userId: string) => {
  const anchorId = (documentKey: string, anchor: string) =>
    uuidFrom(userId, `anchor:${documentKey}:${anchor}`);
  const documentId = (documentKey: string) => uuidFrom(userId, `document:${documentKey}`);
  const ids = {
    project: uuidFrom(userId, "project"),
    flashcardCollection: uuidFrom(userId, "flashcard-collection"),
    quizCollection: uuidFrom(userId, "quiz-collection"),
  };

  const documents = exampleDocuments.map((source, position) => {
    const content = documentContentSchema.parse(
      source.blocks.map((block, index) =>
        textBlock(uuidFrom(userId, `block:${source.key}:${index}`), block.text, {
          ...blockType[block.kind],
          anchorId: block.anchor ? anchorId(source.key, block.anchor) : undefined,
        }),
      ),
    );
    return {
      id: documentId(source.key),
      title: source.title,
      position,
      content,
      contentByteSize: utf8ByteLength(JSON.stringify(content)),
    };
  });

  const flashcards = exampleFlashcards.map((card) => ({
    id: uuidFrom(userId, `flashcard:${card.key}`),
    question: richText(uuidFrom(userId, `flashcard:${card.key}:question`), card.question),
    answer: richText(uuidFrom(userId, `flashcard:${card.key}:answer`), card.answer),
    questionText: card.question,
    answerText: card.answer,
    documentId: documentId(card.document),
    anchorId: anchorId(card.document, card.anchor),
  }));

  const quizQuestions = exampleQuestions.map((question) => ({
    id: uuidFrom(userId, `quiz:${question.key}`),
    content: quizQuestionContentSchema.parse([
      textBlock(uuidFrom(userId, `quiz:${question.key}:content`), question.question),
    ]),
    contentText: question.question,
    options: question.options,
    correctOptionIndex: question.correctOptionIndex,
    documentId: documentId(question.document),
    anchorId: anchorId(question.document, question.anchor),
  }));

  return {
    ids,
    project: { id: ids.project, title: "Exemplo: aprendendo a aprender", coverKey: null },
    documents,
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
      .values({ ...fixture.project, quotaExempt: true, userId })
      .onConflictDoNothing({ target: project.id })
      .returning({ id: project.id });

    if (!createdProject) return { created: false as const };

    await tx.insert(projectItem).values(
      fixture.documents.map((item) => ({
        id: item.id,
        projectId: fixture.project.id,
        parentId: null,
        type: "document" as const,
        title: item.title,
        position: item.position,
      })),
    );
    await tx.insert(document).values(
      fixture.documents.map((item) => ({
        id: item.id,
        content: item.content,
        contentByteSize: item.contentByteSize,
      })),
    );
    // PostgreSQL document JSON is metadata, not billable object storage.
    await tx.insert(userStorage).values({ userId }).onConflictDoNothing();

    await tx.insert(flashcardCollection).values({
      ...fixture.flashcardCollection,
      userId,
      projectId: fixture.project.id,
    });
    await tx.insert(flashcard).values(
      fixture.flashcards.map(({ answer, answerText, id, question, questionText }) => ({
        id,
        question,
        answer,
        questionText,
        answerText,
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

    // Every material points at the passage it came from, in its own document.
    await tx.insert(studyMaterialReference).values([
      ...fixture.flashcards.map((card) => ({
        id: uuidFrom(userId, `reference:${card.id}`),
        userId,
        documentId: card.documentId,
        anchorId: card.anchorId,
        flashcardId: card.id,
      })),
      ...fixture.quizQuestions.map((question) => ({
        id: uuidFrom(userId, `reference:${question.id}`),
        userId,
        documentId: question.documentId,
        anchorId: question.anchorId,
        quizQuestionId: question.id,
      })),
    ]);

    return { created: true as const };
  });
};
