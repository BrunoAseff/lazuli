import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import type { AiGenerationService } from "./ai-generation-service.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";
import { createAiGenerationRoutes } from "./ai-generation-routes.ts";

const queries = vi.hoisted(() => ({
  approveAiSelectionGeneration: vi.fn(),
  prepareAiSelectionGeneration: vi.fn(),
}));
vi.mock("./ai-selection-queries.ts", () => queries);

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
    generateFoundationDraft: vi.fn(),
    generateSelectionDraft,
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
      payload: {
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
      },
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
});
