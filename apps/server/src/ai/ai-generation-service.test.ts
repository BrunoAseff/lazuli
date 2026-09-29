import { describe, expect, it, vi } from "vitest";

import { AiGenerationError } from "./ai-errors.ts";
import type {
  AiGenerationRecord,
  AiGenerationStore,
  BeginAiGenerationInput,
  CompleteAiGenerationInput,
} from "./ai-generation-store.ts";
import { createAiGenerationService } from "./ai-generation-service.ts";
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
  },
) => {
  const begin = vi.fn<(input: BeginAiGenerationInput) => Promise<typeof beginResult>>();
  begin.mockResolvedValue(beginResult);
  return {
    begin,
    complete: vi.fn<(input: CompleteAiGenerationInput) => Promise<void>>().mockResolvedValue(),
    fail: vi.fn<AiGenerationStore["fail"]>().mockResolvedValue(),
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
