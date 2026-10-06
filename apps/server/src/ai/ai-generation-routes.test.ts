import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import type { AiGenerationService } from "./ai-generation-service.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";
import { createAiGenerationRoutes } from "./ai-generation-routes.ts";

const queries = vi.hoisted(() => ({
  approveAiSelectionGeneration: vi.fn(),
  prepareAiCollectionGeneration: vi.fn(),
  prepareAiSelectionGeneration: vi.fn(),
}));
vi.mock("./ai-selection-queries.ts", () => queries);
const improvementQueries = vi.hoisted(() => ({
  applyAiMaterialImprovement: vi.fn(),
  prepareAiMaterialImprovement: vi.fn(),
}));
vi.mock("./ai-material-improvement-queries.ts", () => improvementQueries);

const documentId = "11111111-1111-4111-8111-111111111111";
const collectionId = "22222222-2222-4222-8222-222222222222";
const operationId = "33333333-3333-4333-8333-333333333333";
const requestBody = {
  anchorId: "anchor-1",
  collectionId,
  documentId,
  expectedRevision: 2,
  guidance: "",
  idempotencyKey: "44444444-4444-4444-8444-444444444444",
  kind: "flashcard",
  quantity: 1,
  selectedText: "Um trecho suficientemente longo para gerar um material.",
  sourceScope: "selection",
  sourceBlockIds: ["block-1"],
};
const collectionRequestBody = {
  collectionId,
  documentId,
  expectedRevision: 2,
  guidance: "",
  idempotencyKey: "55555555-5555-4555-8555-555555555555",
  kind: "flashcard",
  quantity: 5,
  sourceBlockIds: ["block-1"],
};
const approvalRequestBody = {
  anchoredContent: [
    {
      content: [
        {
          styles: { sourceAnchor: "anchor-1" },
          text: requestBody.selectedText,
          type: "text",
        },
      ],
      id: "block-1",
      type: "paragraph",
    },
  ],
  expectedRevision: 2,
  flashcards: [
    {
      answer: [
        {
          content: [{ styles: {}, text: "Resposta", type: "text" }],
          id: "answer-1",
          type: "paragraph",
        },
      ],
      id: "55555555-5555-4555-8555-555555555555",
      question: [
        {
          content: [{ styles: {}, text: "Pergunta?", type: "text" }],
          id: "question-1",
          type: "paragraph",
        },
      ],
    },
  ],
  quizQuestions: [],
};
const session = {
  session: { id: "session-1" },
  user: { email: "ana@example.com", id: "user-1", name: "Ana" },
};
const auth = {
  api: { getSession: vi.fn().mockResolvedValue(session) },
} as unknown as Auth;
const database = {} as Database;
const storageGet = vi.fn();
const storage = { get: storageGet } as unknown as ObjectStorage;
const apps: ReturnType<typeof Fastify>[] = [];

const register = async (serviceOverrides: Partial<AiGenerationService> = {}) => {
  const generateSelectionDraft = vi.fn().mockResolvedValue({ kind: "in-progress", operationId });
  const service = {
    discardCollectionDraft: vi.fn().mockResolvedValue(false),
    discardMaterialImprovementDraft: vi.fn().mockResolvedValue(false),
    enqueueCollectionDraft: vi.fn().mockResolvedValue({ kind: "queued", operationId }),
    generateFoundationDraft: vi.fn(),
    generateMaterialImprovementDraft: vi
      .fn()
      .mockResolvedValue({ kind: "in-progress", operationId }),
    generateSelectionDraft,
    getCollectionDraft: vi.fn().mockResolvedValue(null),
    getLatestCollectionDraft: vi.fn().mockResolvedValue(null),
    getMaterialImprovementDraft: vi.fn().mockResolvedValue(null),
    getSelectionDraft: vi.fn().mockResolvedValue(null),
    ...serviceOverrides,
  } as unknown as AiGenerationService;
  const app = Fastify({ logger: false });
  apps.push(app);
  await app.register(
    createAiGenerationRoutes({
      auth,
      database,
      service,
      storage,
      websiteUrl: "http://localhost:3000",
    }),
  );
  return { app, generateSelectionDraft };
};

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("AI material improvement routes", () => {
  it("rebuilds an owned flashcard before generating a proposal", async () => {
    improvementQueries.prepareAiMaterialImprovement.mockResolvedValue({
      kind: "ok",
      material: {
        answer: [{ id: "a", type: "paragraph", content: [] }],
        answerText: "Resposta atual",
        question: [{ id: "q", type: "paragraph", content: [] }],
        questionText: "Pergunta atual",
        updatedAt: new Date("2026-10-05T12:00:00.000Z"),
      },
      references: [],
    });
    const generateMaterialImprovementDraft = vi
      .fn()
      .mockResolvedValue({ kind: "in-progress", operationId });
    const { app } = await register({ generateMaterialImprovementDraft });
    const response = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "POST",
      payload: {
        collectionId,
        guidance: "",
        idempotencyKey: "66666666-6666-4666-8666-666666666666",
        intent: "clarify",
        kind: "flashcard",
        materialId: "77777777-7777-4777-8777-777777777777",
      },
      url: "/api/ai/material-improvements",
    });

    expect(response.statusCode).toBe(202);
    expect(generateMaterialImprovementDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        promptCurrent: { answer: "Resposta atual", question: "Pergunta atual" },
        userId: "user-1",
      }),
    );
  });

  it("preserves quiz option IDs in the editable current snapshot", async () => {
    const options = [
      {
        id: "10000000-0000-4000-8000-000000000000",
        isCorrect: true,
        position: 0,
        text: "Alternativa correta",
      },
      {
        id: "20000000-0000-4000-8000-000000000000",
        isCorrect: false,
        position: 1,
        text: "Alternativa incorreta",
      },
    ];
    improvementQueries.prepareAiMaterialImprovement.mockResolvedValue({
      kind: "ok",
      material: {
        content: [{ id: "q", type: "paragraph", content: [] }],
        contentText: "Qual é a alternativa correta?",
        options,
        updatedAt: new Date("2026-10-05T12:00:00.000Z"),
      },
      references: [],
    });
    const generateMaterialImprovementDraft = vi
      .fn()
      .mockResolvedValue({ kind: "in-progress", operationId });
    const { app } = await register({ generateMaterialImprovementDraft });
    const response = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "POST",
      payload: {
        collectionId,
        guidance: "",
        idempotencyKey: "99999999-9999-4999-8999-999999999999",
        intent: "improveOptions",
        kind: "quizQuestion",
        materialId: "77777777-7777-4777-8777-777777777777",
      },
      url: "/api/ai/material-improvements",
    });

    expect(response.statusCode).toBe(202);
    expect(generateMaterialImprovementDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        current: expect.objectContaining({ options }),
        promptCurrent: {
          correctOptionIndex: 0,
          options: options.map(({ text }) => text),
          prompt: "Qual é a alternativa correta?",
        },
      }),
    );
  });
});

describe("AI collection generation routes", () => {
  it("queues a persistent batch after rebuilding the authorized source", async () => {
    queries.prepareAiCollectionGeneration.mockResolvedValue({
      blocks: [{ id: "block-1", text: "Conteúdo autorizado da seção." }],
      documentRevision: 2,
      kind: "ok",
    });
    const enqueueCollectionDraft = vi.fn().mockResolvedValue({ kind: "queued", operationId });
    const { app } = await register({ enqueueCollectionDraft });
    const response = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "POST",
      payload: collectionRequestBody,
      url: "/api/ai/collection-generations",
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ operationId, status: "queued" });
    expect(enqueueCollectionDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionId,
        documentRevision: 2,
        sourceBlockIds: ["block-1"],
        sourceScope: "section",
        userId: "user-1",
      }),
    );
  });

  it("rejects an oversized source before reserving credits", async () => {
    queries.prepareAiCollectionGeneration.mockResolvedValue({ kind: "source-too-large" });
    const enqueueCollectionDraft = vi.fn();
    const { app } = await register({ enqueueCollectionDraft });
    const response = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "POST",
      payload: collectionRequestBody,
      url: "/api/ai/collection-generations",
    });

    expect(response.statusCode).toBe(422);
    expect(enqueueCollectionDraft).not.toHaveBeenCalled();
  });

  it("returns the latest queued batch for the authenticated user", async () => {
    const getLatestCollectionDraft = vi.fn().mockResolvedValue({ kind: "queued", operationId });
    const { app } = await register({ getLatestCollectionDraft });
    const response = await app.inject({
      method: "GET",
      url: `/api/ai/collection-generations/latest?collectionId=${collectionId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ operationId, status: "queued" });
    expect(getLatestCollectionDraft).toHaveBeenCalledWith("user-1", collectionId);
  });

  it("discards an owned completed batch", async () => {
    const discardCollectionDraft = vi.fn().mockResolvedValue(true);
    const { app } = await register({ discardCollectionDraft });
    const response = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "DELETE",
      url: `/api/ai/collection-generations/${operationId}`,
    });

    expect(response.statusCode).toBe(204);
    expect(discardCollectionDraft).toHaveBeenCalledWith("user-1", operationId);
  });
});

describe("AI selection generation routes", () => {
  it("rejects generation from an untrusted origin", async () => {
    const { app, generateSelectionDraft } = await register();
    const response = await app.inject({
      headers: { origin: "https://malicious.example" },
      method: "POST",
      payload: requestBody,
      url: "/api/ai/selection-generations",
    });

    expect(response.statusCode).toBe(403);
    expect(generateSelectionDraft).not.toHaveBeenCalled();
  });

  it("reconstructs the authenticated source before admitting a generation", async () => {
    queries.prepareAiSelectionGeneration.mockResolvedValue({
      blocks: [{ id: "block-1", text: requestBody.selectedText }],
      documentRevision: 2,
      kind: "ok",
    });
    const { app, generateSelectionDraft } = await register();
    const response = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "POST",
      payload: requestBody,
      url: "/api/ai/selection-generations",
    });

    expect(response.statusCode).toBe(202);
    expect(generateSelectionDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: [{ id: "block-1", text: requestBody.selectedText }],
        userId: "user-1",
      }),
    );
  });

  it("loads an authorized image from storage before multimodal generation", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    queries.prepareAiSelectionGeneration.mockResolvedValue({
      blocks: [{ id: "image-block-1", text: "Imagem selecionada" }],
      documentRevision: 2,
      imageAsset: { mimeType: "image/png", objectKey: "documents/image.png" },
      kind: "ok",
      selectedText: "Imagem selecionada",
      sourceBlockIds: ["image-block-1"],
    });
    storageGet.mockResolvedValue({
      Body: { transformToByteArray: vi.fn().mockResolvedValue(bytes) },
    });
    const { app, generateSelectionDraft } = await register();
    const response = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "POST",
      payload: {
        ...requestBody,
        anchorId: "image-block-1",
        selectedText: "",
        sourceBlockIds: ["image-block-1"],
        sourceScope: "image",
      },
      url: "/api/ai/selection-generations",
    });

    expect(response.statusCode).toBe(202);
    expect(generateSelectionDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [{ data: bytes, mediaType: "image/png" }],
        sourceScope: "image",
      }),
    );
  });

  it("asks for a new selection when the authorized source changed", async () => {
    queries.prepareAiSelectionGeneration.mockResolvedValue({ kind: "source-changed" });
    const { app, generateSelectionDraft } = await register();
    const response = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "POST",
      payload: requestBody,
      url: "/api/ai/selection-generations",
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: "AI_SOURCE_CHANGED" });
    expect(generateSelectionDraft).not.toHaveBeenCalled();
  });

  it("approves materials only through the authenticated atomic query", async () => {
    queries.approveAiSelectionGeneration.mockResolvedValue({
      createdIds: ["55555555-5555-4555-8555-555555555555"],
      kind: "ok",
      revision: 3,
    });
    const { app } = await register();
    const response = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "POST",
      payload: approvalRequestBody,
      url: `/api/ai/generations/${operationId}/approve`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      createdIds: ["55555555-5555-4555-8555-555555555555"],
      revision: 3,
    });
    expect(queries.approveAiSelectionGeneration).toHaveBeenCalledWith(
      database,
      "user-1",
      operationId,
      expect.any(Object),
    );
  });

  it("reports the material whose reference cannot be anchored", async () => {
    queries.approveAiSelectionGeneration.mockResolvedValue({
      itemId: approvalRequestBody.flashcards[0]!.id,
      kind: "reference-unanchorable",
    });
    const { app } = await register();
    const response = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "POST",
      payload: approvalRequestBody,
      url: `/api/ai/generations/${operationId}/approve`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: "AI_REFERENCE_UNANCHORABLE",
      itemId: approvalRequestBody.flashcards[0]!.id,
      message:
        "Não foi possível vincular uma referência ao trecho escolhido. Ajuste a referência e tente novamente.",
    });
  });
});
