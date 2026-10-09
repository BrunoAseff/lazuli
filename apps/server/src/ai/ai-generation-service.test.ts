import { describe, expect, it, vi } from "vitest";
import { AI_DOCUMENT_MAX_BLOCKS } from "@lazuli/shared";

import { AiGenerationError } from "./ai-errors.ts";
import type {
  AiGenerationRecord,
  AiGenerationStore,
  BeginAiGenerationInput,
  CompleteAiGenerationInput,
} from "./ai-generation-store.ts";
import { AI_MAX_CONTEXT_BYTES } from "./ai-model-config.ts";
import { createAiGenerationService } from "./ai-generation-service.ts";
import { createDevelopmentAiProvider } from "./development-ai-provider.ts";
import { createFakeAiProvider } from "./fake-ai-provider.ts";

const validDraft = {
  flashcards: [
    {
      answer: "Porque exige recuperar a informação da memória.",
      question: "Por que a recuperação ativa melhora a retenção?",
      sourceBlockIds: ["block-1"],
    },
  ],
  quizQuestions: [
    {
      correctOptionIndex: 1,
      options: [
        "Reler sem testar",
        "Recuperar a informação",
        "Copiar o conteúdo",
        "Ignorar o feedback",
      ],
      prompt: "Qual prática exige esforço ativo de memória?",
      sourceBlockIds: ["block-1"],
    },
  ],
};

const validSelectionDraft = {
  flashcards: [
    {
      answer: "Porque exige recuperar a informação da memória.",
      evidence: "Recuperar uma ideia fortalece a memória.",
      references: [{ blockId: "block-1", quote: "Recuperar uma ideia fortalece a memória." }],
      question: "Por que a recuperação ativa melhora a retenção?",
      sourceBlockIds: ["block-1"],
      warning: null,
    },
  ],
  quizQuestions: [],
};

const createRecord = (overrides: Partial<AiGenerationRecord> = {}): AiGenerationRecord => ({
  approvedItems: 0,
  attempts: 0,
  availableAt: new Date(),
  cachedInputTokens: null,
  cancelRequestedAt: null,
  contextFingerprint: "fingerprint",
  createdAt: new Date(),
  effectiveModel: null,
  errorCode: null,
  estimatedCredits: 20,
  estimatedCostMicroUsd: null,
  expiresAt: null,
  finishedAt: null,
  id: "operation-1",
  idempotencyKey: "request-1",
  inputTokens: null,
  latencyMs: null,
  leaseOwner: null,
  leasedUntil: null,
  origin: "internal",
  outputTokens: null,
  promptVersion: "foundation-draft-v1",
  provider: "fake",
  providerRequestId: null,
  regenerationOfId: null,
  requestedItems: 2,
  requestedModel: "fake-luna",
  result: null,
  sourceIds: ["document-1"],
  startedAt: new Date(),
  status: "running",
  reservedCredits: 20,
  consumedCredits: 0,
  totalTokens: null,
  type: "foundation_draft",
  userId: "user-1",
  validItems: 0,
  ...overrides,
});

const createStore = (
  beginResult: Awaited<ReturnType<AiGenerationStore["begin"]>> = {
    kind: "created",
    operation: createRecord(),
    regenerationCount: 0,
  },
) => {
  const begin = vi.fn<(input: BeginAiGenerationInput) => Promise<typeof beginResult>>();
  begin.mockResolvedValue(beginResult);
  return {
    begin,
    complete: vi.fn<(input: CompleteAiGenerationInput) => Promise<void>>().mockResolvedValue(),
    discardCollection: vi.fn<AiGenerationStore["discardCollection"]>().mockResolvedValue(false),
    discardMaterialImprovement: vi
      .fn<AiGenerationStore["discardMaterialImprovement"]>()
      .mockResolvedValue(false),
    fail: vi.fn<AiGenerationStore["fail"]>().mockResolvedValue(),
    get: vi.fn<AiGenerationStore["get"]>().mockResolvedValue(null),
    findLatestCollection: vi
      .fn<AiGenerationStore["findLatestCollection"]>()
      .mockResolvedValue(null),
  } satisfies AiGenerationStore;
};

const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
const input = {
  blocks: [{ id: "block-1", text: "Recuperar uma ideia fortalece a memória." }],
  idempotencyKey: "request-1",
  sourceIds: ["document-1"],
  userId: "user-1",
};

describe("AI generation service", () => {
  it("reads collection drafts created before quizzes required four generated alternatives", async () => {
    const legacyDraft = {
      anchorId: null,
      approved: false,
      collectionId: "11111111-1111-4111-8111-111111111111",
      consumedCredits: 10,
      documentId: "22222222-2222-4222-8222-222222222222",
      documentRevision: 3,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      flashcards: [],
      kind: "quizQuestion",
      operationId: "33333333-3333-4333-8333-333333333333",
      quizQuestions: [
        {
          correctOptionIndex: 0,
          evidence: "Trecho usado para produzir a questão.",
          id: "44444444-4444-4444-8444-444444444444",
          options: ["Correta", "Incorreta"],
          prompt: "Qual alternativa está correta?",
          warning: null,
        },
      ],
      regenerationCount: 0,
      requestedItems: 1,
      sourceBlockIds: ["block-1"],
      sourceScope: "document",
      sourceText: "Trecho usado para produzir a questão.",
    };
    const record = createRecord({
      consumedCredits: 10,
      expiresAt: new Date(Date.now() + 60_000),
      id: legacyDraft.operationId,
      origin: "collection",
      result: legacyDraft,
      status: "succeeded",
      type: "collection_generation",
      validItems: 1,
    });
    const store = createStore();
    store.findLatestCollection.mockResolvedValue(record);
    store.get.mockResolvedValue(record);
    const service = createAiGenerationService({
      logger,
      provider: createFakeAiProvider({ output: validSelectionDraft }),
      store,
    });

    await expect(
      service.getLatestCollectionDraft("user-1", legacyDraft.collectionId),
    ).resolves.toMatchObject({
      draft: { quizQuestions: [{ options: ["Correta", "Incorreta"] }] },
      kind: "completed",
    });
  });

  it("queues a collection batch without calling the provider in the request", async () => {
    const store = createStore();
    const provider = createFakeAiProvider({ output: validSelectionDraft });
    const generate = vi.spyOn(provider, "generateStructured");
    const service = createAiGenerationService({ logger, provider, store });

    await expect(
      service.enqueueCollectionDraft({
        collectionId: "11111111-1111-4111-8111-111111111111",
        documentId: "22222222-2222-4222-8222-222222222222",
        documentRevision: 3,
        guidance: "",
        idempotencyKey: "33333333-3333-4333-8333-333333333333",
        kind: "flashcard",
        quantity: 5,
        sourceBlockIds: ["block-1"],
        sourceScope: "section",
        userId: input.userId,
      }),
    ).resolves.toMatchObject({ kind: "queued" });
    expect(generate).not.toHaveBeenCalled();
    expect(store.begin).toHaveBeenCalledWith(
      expect.objectContaining({
        estimatedCredits: 50,
        initialResult: {
          job: expect.objectContaining({
            collectionId: "11111111-1111-4111-8111-111111111111",
            quantity: 5,
          }),
        },
        type: "collection_generation",
      }),
    );
  });

  it("processes a collection batch and settles only valid returned materials", async () => {
    const store = createStore();
    const service = createAiGenerationService({
      logger,
      provider: createFakeAiProvider({ output: validSelectionDraft }),
      retryDelayMs: 0,
      store,
    });

    await service.processCollectionDraft({
      blocks: input.blocks,
      job: {
        collectionId: "11111111-1111-4111-8111-111111111111",
        documentId: "22222222-2222-4222-8222-222222222222",
        documentRevision: 3,
        guidance: "",
        kind: "flashcard",
        quantity: 5,
        sourceBlockIds: ["block-1"],
        sourceScope: "section",
      },
      operationId: "33333333-3333-4333-8333-333333333333",
      userId: input.userId,
    });

    expect(store.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: "33333333-3333-4333-8333-333333333333",
        result: expect.objectContaining({
          consumedCredits: 10,
          flashcards: [
            expect.objectContaining({
              references: [
                {
                  blockId: "block-1",
                  quote: "Recuperar uma ideia fortalece a memória.",
                  scope: "selection",
                },
              ],
            }),
          ],
          requestedItems: 5,
          sourceScope: "section",
        }),
        validItems: 1,
      }),
    );
  });

  it("settles an oversized collection source through the normal failure path", async () => {
    const store = createStore();
    const service = createAiGenerationService({
      logger,
      provider: createFakeAiProvider({ output: validSelectionDraft }),
      store,
    });

    await expect(
      service.processCollectionDraft({
        blocks: Array.from({ length: AI_DOCUMENT_MAX_BLOCKS + 1 }, (_, index) => ({
          id: `block-${index}`,
          text: "Conteúdo",
        })),
        job: {
          collectionId: "11111111-1111-4111-8111-111111111111",
          documentId: "22222222-2222-4222-8222-222222222222",
          documentRevision: 3,
          guidance: "",
          kind: "flashcard",
          quantity: 1,
          sourceBlockIds: [],
          sourceScope: "document",
        },
        operationId: "33333333-3333-4333-8333-333333333333",
        userId: input.userId,
      }),
    ).rejects.toMatchObject({ code: "AI_INPUT_TOO_LARGE" });

    expect(store.complete).not.toHaveBeenCalled();
    expect(store.fail).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "AI_INPUT_TOO_LARGE",
        operationId: "33333333-3333-4333-8333-333333333333",
      }),
    );
  });

  it("creates an editable selection draft and settles only its valid proposals", async () => {
    const store = createStore();
    const service = createAiGenerationService({
      logger,
      provider: createFakeAiProvider({ output: validSelectionDraft }),
      retryDelayMs: 0,
      store,
    });

    const result = await service.generateSelectionDraft({
      anchorId: "anchor-1",
      blocks: input.blocks,
      collectionId: "11111111-1111-4111-8111-111111111111",
      context: { after: [], before: [], documentTitle: "Memória" },
      documentId: "22222222-2222-4222-8222-222222222222",
      documentRevision: 3,
      guidance: "",
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
      kind: "flashcard",
      quantity: 2,
      selectedText: input.blocks[0]!.text,
      sourceScope: "selection",
      sourceBlockIds: ["block-1"],
      userId: input.userId,
    });

    expect(result).toMatchObject({
      kind: "completed",
      reused: false,
      draft: {
        approved: false,
        consumedCredits: 10,
        regenerationCount: 0,
        requestedItems: 2,
        flashcards: [
          expect.objectContaining({
            references: [
              {
                blockId: "block-1",
                quote: "Recuperar uma ideia fortalece a memória.",
                scope: "selection",
              },
            ],
          }),
        ],
      },
    });
    expect(store.complete).toHaveBeenCalledWith(expect.objectContaining({ validItems: 1 }));
  });

  it("keeps a generated material but rejects evidence outside the authorized source", async () => {
    const store = createStore();
    const service = createAiGenerationService({
      logger,
      provider: createFakeAiProvider({
        output: {
          ...validSelectionDraft,
          flashcards: [
            {
              ...validSelectionDraft.flashcards[0]!,
              references: [{ blockId: "invented-block", quote: "Texto inventado" }],
              sourceBlockIds: ["invented-block"],
            },
          ],
        },
      }),
      retryDelayMs: 0,
      store,
    });

    await service.processCollectionDraft({
      blocks: input.blocks,
      job: {
        collectionId: "11111111-1111-4111-8111-111111111111",
        documentId: "22222222-2222-4222-8222-222222222222",
        documentRevision: 3,
        guidance: "",
        kind: "flashcard",
        quantity: 1,
        sourceBlockIds: [],
        sourceScope: "document",
      },
      operationId: "33333333-3333-4333-8333-333333333333",
      userId: input.userId,
    });

    expect(store.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        result: expect.objectContaining({
          flashcards: [
            expect.objectContaining({
              references: [],
              referenceWarning:
                "A referência sugerida não foi encontrada literalmente no documento.",
            }),
          ],
        }),
        validItems: 1,
      }),
    );
  });

  it("keeps a generated material but rejects an ambiguous literal reference", async () => {
    const store = createStore();
    const service = createAiGenerationService({
      logger,
      provider: createFakeAiProvider({
        output: {
          ...validSelectionDraft,
          flashcards: [
            {
              ...validSelectionDraft.flashcards[0]!,
              references: [{ blockId: "block-1", quote: "conceito" }],
            },
          ],
        },
      }),
      retryDelayMs: 0,
      store,
    });

    await service.processCollectionDraft({
      blocks: [{ id: "block-1", text: "conceito relacionado a outro conceito" }],
      job: {
        collectionId: "11111111-1111-4111-8111-111111111111",
        documentId: "22222222-2222-4222-8222-222222222222",
        documentRevision: 3,
        guidance: "",
        kind: "flashcard",
        quantity: 1,
        sourceBlockIds: [],
        sourceScope: "document",
      },
      operationId: "33333333-3333-4333-8333-333333333333",
      userId: input.userId,
    });

    expect(store.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        result: expect.objectContaining({
          flashcards: [
            expect.objectContaining({
              references: [],
              referenceWarning:
                "A referência sugerida não foi encontrada literalmente no documento.",
            }),
          ],
        }),
      }),
    );
  });

  it("generates a development draft from a whole document with more than ten blocks", async () => {
    const store = createStore();
    const service = createAiGenerationService({
      logger,
      provider: createDevelopmentAiProvider(),
      retryDelayMs: 0,
      store,
    });
    const blocks = Array.from({ length: 20 }, (_, index) => ({
      id: `block-${index + 1}`,
      text:
        index === 0
          ? `Conteúdo relevante do bloco 1. ${"Detalhe complementar. ".repeat(12)}Conclusão singular do bloco.`
          : `Conteúdo relevante do bloco ${index + 1}.`,
    }));

    const result = await service.generateSelectionDraft({
      anchorId: null,
      blocks,
      collectionId: "11111111-1111-4111-8111-111111111111",
      context: { after: [], before: [], documentTitle: "Documento extenso" },
      documentId: "22222222-2222-4222-8222-222222222222",
      documentRevision: 3,
      guidance: "",
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
      kind: "flashcard",
      quantity: 1,
      selectedText: blocks.map(({ text }) => text).join(" "),
      sourceScope: "document",
      sourceBlockIds: blocks.map(({ id }) => id),
      userId: input.userId,
    });

    expect(result).toMatchObject({
      draft: { flashcards: [{ question: "Qual é a ideia central de Documento extenso?" }] },
      kind: "completed",
    });
    if (result.kind === "completed")
      expect(result.draft.flashcards[0]!.references[0]!.quote.length).toBeLessThanOrEqual(120);
    expect(store.complete).toHaveBeenCalledWith(expect.objectContaining({ validItems: 1 }));
  });

  it("accepts the documented block limit alongside adjacent selection context", async () => {
    const store = createStore();
    const service = createAiGenerationService({
      logger,
      provider: createDevelopmentAiProvider(),
      retryDelayMs: 0,
      store,
    });
    const blocks = Array.from({ length: AI_DOCUMENT_MAX_BLOCKS }, (_, index) => ({
      id: `block-${index + 1}`,
      text: `Conteúdo relevante ${index + 1}.`,
    }));

    const result = await service.generateSelectionDraft({
      anchorId: null,
      blocks,
      collectionId: "11111111-1111-4111-8111-111111111111",
      context: {
        after: [{ id: "after", text: "Contexto posterior." }],
        before: [{ id: "before", text: "Contexto anterior." }],
        documentTitle: "Documento no limite",
        projectTitle: "Projeto",
        sectionTitle: "Seção",
      },
      documentId: "22222222-2222-4222-8222-222222222222",
      documentRevision: 3,
      guidance: "",
      idempotencyKey: "33333333-3333-4333-8333-333333333334",
      kind: "flashcard",
      quantity: 1,
      selectedText: blocks.map(({ text }) => text).join(" "),
      sourceScope: "document",
      sourceBlockIds: blocks.map(({ id }) => id),
      userId: input.userId,
    });

    expect(result.kind).toBe("completed");
  });

  it("uses explicit simulated content for images while real AI calls are disabled", async () => {
    const store = createStore();
    const service = createAiGenerationService({
      logger,
      provider: createDevelopmentAiProvider(),
      retryDelayMs: 0,
      store,
    });

    const result = await service.generateSelectionDraft({
      anchorId: "image-block-1",
      blocks: [{ id: "image-block-1", text: "Imagem selecionada" }],
      collectionId: "11111111-1111-4111-8111-111111111111",
      context: { after: [], before: [], documentTitle: "Imagem" },
      documentId: "22222222-2222-4222-8222-222222222222",
      documentRevision: 3,
      guidance: "",
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
      images: [{ data: new Uint8Array([1, 2, 3]), mediaType: "image/png" }],
      kind: "flashcard",
      quantity: 1,
      selectedText: "Imagem selecionada",
      sourceScope: "image",
      sourceBlockIds: ["image-block-1"],
      userId: input.userId,
    });

    expect(result).toMatchObject({
      draft: {
        flashcards: [
          {
            answer: "Conteúdo visual simulado no ambiente de desenvolvimento.",
            question: "Qual é a ideia central desta imagem?",
          },
        ],
      },
      kind: "completed",
    });
  });

  it("does not consume additional credits for a free regeneration", async () => {
    const store = createStore({
      kind: "created",
      operation: createRecord({ regenerationOfId: "operation-root", reservedCredits: 0 }),
      regenerationCount: 2,
    });
    const service = createAiGenerationService({
      logger,
      provider: createFakeAiProvider({ output: validSelectionDraft }),
      store,
    });

    const result = await service.generateSelectionDraft({
      anchorId: "anchor-1",
      blocks: input.blocks,
      collectionId: "11111111-1111-4111-8111-111111111111",
      context: { after: [], before: [], documentTitle: "Memória" },
      documentId: "22222222-2222-4222-8222-222222222222",
      documentRevision: 3,
      guidance: "",
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
      kind: "flashcard",
      quantity: 1,
      regenerateOperationId: "operation-root",
      selectedText: input.blocks[0]!.text,
      sourceScope: "selection",
      sourceBlockIds: ["block-1"],
      userId: input.userId,
    });

    expect(result).toMatchObject({
      draft: { consumedCredits: 0, regenerationCount: 2 },
    });
  });

  it("persists validated output and usage without persisting source content", async () => {
    const store = createStore();
    const service = createAiGenerationService({
      logger,
      provider: createFakeAiProvider({ output: validDraft }),
      retryDelayMs: 0,
      store,
    });

    const result = await service.generateFoundationDraft(input);

    expect(result).toMatchObject({ kind: "completed", reused: false, draft: validDraft });
    expect(store.begin).toHaveBeenCalledWith(
      expect.objectContaining({
        contextFingerprint: expect.stringMatching(/^[a-f\d]{64}$/),
        estimatedCredits: 20,
        sourceIds: ["document-1"],
      }),
    );
    expect(JSON.stringify(store.begin.mock.calls[0]?.[0])).not.toContain(
      "Recuperar uma ideia fortalece",
    );
    expect(store.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: 1,
        estimatedCostMicroUsd: 52,
        providerRequestId: "fake-response",
        result: validDraft,
        validItems: 2,
      }),
    );
  });

  it("budgets adjacent context independently from source evidence", async () => {
    const store = createStore();
    const service = createAiGenerationService({
      logger,
      provider: createFakeAiProvider({ output: validDraft }),
      retryDelayMs: 0,
      store,
    });
    const content = "a".repeat(Math.floor(AI_MAX_CONTEXT_BYTES * 0.6));

    await expect(
      service.generateFoundationDraft({
        ...input,
        blocks: [{ id: "block-1", text: content }],
        context: {
          after: [{ id: "after", text: content }],
          before: [],
        },
      }),
    ).resolves.toMatchObject({ kind: "completed" });
  });

  it("reuses a successful idempotent operation without calling the provider", async () => {
    const store = createStore({
      kind: "existing",
      operation: createRecord({ result: validDraft, status: "succeeded" }),
    });
    const provider = createFakeAiProvider({ output: undefined });
    const generate = vi.spyOn(provider, "generateStructured");
    const service = createAiGenerationService({ logger, provider, store });

    await expect(service.generateFoundationDraft(input)).resolves.toMatchObject({
      kind: "completed",
      reused: true,
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("retries one transient failure and never retries an invalid result", async () => {
    const store = createStore();
    const provider = createFakeAiProvider({ output: validDraft });
    const generate = vi
      .spyOn(provider, "generateStructured")
      .mockRejectedValueOnce(new AiGenerationError("AI_PROVIDER_UNAVAILABLE", { retryable: true }));
    const service = createAiGenerationService({ logger, provider, retryDelayMs: 0, store });

    await expect(service.generateFoundationDraft(input)).resolves.toMatchObject({
      kind: "completed",
    });
    expect(generate).toHaveBeenCalledTimes(2);

    const invalidStore = createStore();
    const invalidProvider = createFakeAiProvider({ output: { flashcards: [], quizQuestions: [] } });
    const invalidGenerate = vi.spyOn(invalidProvider, "generateStructured");
    const invalidService = createAiGenerationService({
      logger,
      provider: invalidProvider,
      retryDelayMs: 0,
      store: invalidStore,
    });
    await expect(invalidService.generateFoundationDraft(input)).rejects.toMatchObject({
      code: "AI_INVALID_OUTPUT",
    });
    expect(invalidGenerate).toHaveBeenCalledTimes(1);
    expect(invalidStore.fail).toHaveBeenCalledWith(
      expect.objectContaining({ attempts: 1, code: "AI_INVALID_OUTPUT" }),
    );
  });

  it("rejects references to source blocks that were not provided", async () => {
    const store = createStore();
    const provider = createFakeAiProvider({
      output: {
        ...validDraft,
        flashcards: [{ ...validDraft.flashcards[0], sourceBlockIds: ["invented-block"] }],
      },
    });
    const service = createAiGenerationService({ logger, provider, store });

    await expect(service.generateFoundationDraft(input)).rejects.toMatchObject({
      code: "AI_INVALID_OUTPUT",
    });
    expect(store.complete).not.toHaveBeenCalled();
  });

  it("returns known admission states before spending provider tokens", async () => {
    const store = createStore({ kind: "rate-limited" });
    const provider = createFakeAiProvider({ output: validDraft });
    const generate = vi.spyOn(provider, "generateStructured");
    const service = createAiGenerationService({ logger, provider, store });

    await expect(service.generateFoundationDraft(input)).rejects.toMatchObject({
      code: "AI_RATE_LIMITED",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("does not call the provider when the account has insufficient credits", async () => {
    const store = createStore({ kind: "insufficient-credits" });
    const provider = createFakeAiProvider({ output: validDraft });
    const generate = vi.spyOn(provider, "generateStructured");
    const service = createAiGenerationService({ logger, provider, store });

    await expect(service.generateFoundationDraft(input)).rejects.toMatchObject({
      code: "AI_INSUFFICIENT_CREDITS",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("links a regeneration to the original operation without changing its context", async () => {
    const store = createStore();
    const service = createAiGenerationService({
      logger,
      provider: createFakeAiProvider({ output: validDraft }),
      store,
    });

    await service.generateFoundationDraft({ ...input, regenerateOperationId: "operation-root" });
    expect(store.begin).toHaveBeenCalledWith(
      expect.objectContaining({
        estimatedCredits: 20,
        regenerationOfId: "operation-root",
      }),
    );
  });

  it("creates an editable material-improvement draft without applying it", async () => {
    const store = createStore();
    const provider = createFakeAiProvider({
      output: {
        question: "Pergunta mais clara?",
        answer: "Resposta mais objetiva.",
        warning: null,
      },
    });
    const service = createAiGenerationService({ logger, provider, store });
    const current = {
      question: [
        {
          id: "question-block",
          type: "paragraph",
          content: [{ type: "text", text: "Pergunta atual?", styles: {} }],
        },
      ],
      answer: [
        {
          id: "answer-block",
          type: "paragraph",
          content: [{ type: "text", text: "Resposta atual.", styles: {} }],
        },
      ],
    };

    await expect(
      service.generateMaterialImprovementDraft({
        collectionId: "11111111-1111-4111-8111-111111111111",
        current,
        guidance: "",
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
        intent: "clarify",
        kind: "flashcard",
        materialId: "33333333-3333-4333-8333-333333333333",
        materialUpdatedAt: "2026-10-05T12:00:00.000Z",
        promptCurrent: { answer: "Resposta atual.", question: "Pergunta atual?" },
        references: [],
        sources: [],
        userId: "user-1",
      }),
    ).resolves.toMatchObject({
      draft: {
        current,
        proposed: { answer: "Resposta mais objetiva.", question: "Pergunta mais clara?" },
      },
      kind: "completed",
    });
    expect(store.complete).toHaveBeenCalledWith(expect.objectContaining({ validItems: 1 }));
  });

  it("creates a material-improvement draft with the development provider", async () => {
    const store = createStore();
    const service = createAiGenerationService({
      logger,
      provider: createDevelopmentAiProvider(),
      store,
    });
    const current = {
      question: [
        {
          id: "question-block",
          type: "paragraph",
          content: [{ type: "text", text: "Pergunta atual?", styles: {} }],
        },
      ],
      answer: [
        {
          id: "answer-block",
          type: "paragraph",
          content: [{ type: "text", text: "Resposta atual.", styles: {} }],
        },
      ],
    };

    await expect(
      service.generateMaterialImprovementDraft({
        collectionId: "11111111-1111-4111-8111-111111111111",
        current,
        guidance: "",
        idempotencyKey: "44444444-4444-4444-8444-444444444444",
        intent: "clarify",
        kind: "flashcard",
        materialId: "33333333-3333-4333-8333-333333333333",
        materialUpdatedAt: "2026-10-05T12:00:00.000Z",
        promptCurrent: { answer: "Resposta atual.", question: "Pergunta atual?" },
        references: [],
        sources: [],
        userId: "user-1",
      }),
    ).resolves.toMatchObject({
      draft: {
        current,
        proposed: {
          answer: "Em síntese, resposta atual.",
          question: "Com base no conteúdo estudado, pergunta atual?",
        },
      },
      kind: "completed",
    });
  });

  it("creates a quiz improvement draft with the development provider", async () => {
    const store = createStore();
    const service = createAiGenerationService({
      logger,
      provider: createDevelopmentAiProvider(),
      store,
    });
    const options = [
      "Modern French plates are long and white, with blue strips on both sides.",
      "Uma afirmação que contradiz a ideia central da fonte.",
      "Uma informação relacionada, mas não sustentada pela fonte.",
      "Nenhuma das afirmações apresentadas é sustentada pela fonte.",
    ];
    const current = {
      content: [
        {
          id: "question-block",
          type: "paragraph",
          content: [
            { type: "text", text: "Qual alternativa é sustentada pelo trecho?", styles: {} },
          ],
        },
      ],
      options: options.map((text, index) => ({
        id: `${index + 1}0000000-0000-4000-8000-000000000000`,
        isCorrect: index === 0,
        text,
      })),
    };

    await expect(
      service.generateMaterialImprovementDraft({
        collectionId: "11111111-1111-4111-8111-111111111111",
        current,
        guidance: "",
        idempotencyKey: "55555555-5555-4555-8555-555555555555",
        intent: "improveOptions",
        kind: "quizQuestion",
        materialId: "33333333-3333-4333-8333-333333333333",
        materialUpdatedAt: "2026-10-05T12:00:00.000Z",
        promptCurrent: {
          correctOptionIndex: 0,
          options,
          prompt: "Qual alternativa é sustentada pelo trecho?",
        },
        references: [
          {
            anchorId: "anchor-1",
            documentId: "66666666-6666-4666-8666-666666666666",
            documentTitle: "França",
            id: "77777777-7777-4777-8777-777777777777",
            projectId: "88888888-8888-4888-8888-888888888888",
            projectTitle: "Geografia",
            sourcePreview: "Modern French plates are long and white.",
          },
        ],
        sources: [
          {
            id: "77777777-7777-4777-8777-777777777777",
            text: "Modern French plates are long and white.",
          },
        ],
        userId: "user-1",
      }),
    ).resolves.toMatchObject({
      draft: {
        current,
        proposed: {
          correctOptionIndex: 0,
          options,
          prompt: "Com base no conteúdo estudado, qual alternativa é sustentada pelo trecho?",
        },
      },
      kind: "completed",
    });
  });
});
