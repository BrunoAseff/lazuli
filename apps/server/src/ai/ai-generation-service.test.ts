import { describe, expect, it, vi } from "vitest";

import { AiGenerationError } from "./ai-errors.ts";
import type {
  AiGenerationRecord,
  AiGenerationStore,
  BeginAiGenerationInput,
  CompleteAiGenerationInput,
} from "./ai-generation-store.ts";
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
      options: ["Reler sem testar", "Recuperar a informação"],
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
  cachedInputTokens: null,
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
    fail: vi.fn<AiGenerationStore["fail"]>().mockResolvedValue(),
    get: vi.fn<AiGenerationStore["get"]>().mockResolvedValue(null),
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
      },
    });
    expect(store.complete).toHaveBeenCalledWith(expect.objectContaining({ validItems: 1 }));
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
      text: `Conteúdo relevante do bloco ${index + 1}.`,
    }));

    const result = await service.generateSelectionDraft({
      anchorId: null,
      blocks,
      collectionId: "11111111-1111-4111-8111-111111111111",
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
      draft: { flashcards: [{ question: "Qual é a ideia central deste trecho?" }] },
      kind: "completed",
    });
    expect(store.complete).toHaveBeenCalledWith(expect.objectContaining({ validItems: 1 }));
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
});
