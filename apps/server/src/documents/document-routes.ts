import {
  createProjectItemSchema,
  DOCUMENT_MAX_CONTENT_BYTES,
  saveDocumentContentSchema,
  updateProjectItemSchema,
} from "@lazuli/shared";
import type { DocumentBlock } from "@lazuli/shared";
import type { FastifyPluginAsync } from "fastify";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import { requireTrustedOrigin } from "../auth/require-trusted-origin.ts";
import type { Database } from "../database/client.ts";
import { exportDocumentToMarkdown } from "../document-imports/document-converters.ts";
import {
  createProjectItem,
  deleteProjectItem,
  getDocument,
  listProjectTree,
  saveDocumentContent,
  updateProjectItem,
} from "./document-queries.ts";
import {
  documentValidationError,
  parseDocumentParams,
  serializeProjectItem,
} from "./document-route-utils.ts";

type Options = { auth: Auth; database: Database; websiteUrl: string };
export const createDocumentRoutes = ({ auth, database, websiteUrl }: Options): FastifyPluginAsync =>
  async function documentRoutes(app) {
    app.get("/api/projects/:projectId/tree", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const { projectId } = parseDocumentParams(request);
      if (!projectId.success) return documentValidationError(reply);
      const items = await listProjectTree(database, session.user.id, projectId.data);
      if (!items)
        return reply
          .status(404)
          .send({ code: "PROJECT_NOT_FOUND", message: "Este projeto não foi encontrado." });
      return { items: items.map(serializeProjectItem) };
    });

    app.post("/api/projects/:projectId/items", async (request, reply) => {
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const { projectId } = parseDocumentParams(request);
      const input = createProjectItemSchema.safeParse(request.body);
      if (!projectId.success || !input.success) return documentValidationError(reply);
      const result = await createProjectItem(database, session.user.id, projectId.data, input.data);
      if (result.kind === "not-found")
        return reply
          .status(404)
          .send({ code: "PROJECT_NOT_FOUND", message: "Este projeto não foi encontrado." });
      if (result.kind === "invalid-parent")
        return reply
          .status(400)
          .send({ code: "INVALID_PARENT", message: "Escolha uma pasta válida." });
      if (result.kind === "conflict")
        return reply.status(409).send({
          code: "ITEM_CREATE_CONFLICT",
          message: "Não foi possível concluir esta criação.",
        });
      request.log.info(
        { itemId: result.item.id, projectId: projectId.data, userId: session.user.id },
        "project item creation completed",
      );
      return reply
        .status(result.kind === "created" ? 201 : 200)
        .send(serializeProjectItem(result.item));
    });

    app.patch("/api/projects/:projectId/items/:itemId", async (request, reply) => {
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const { projectId, itemId } = parseDocumentParams(request);
      const input = updateProjectItemSchema.safeParse(request.body);
      if (!projectId.success || !itemId.success || !input.success)
        return documentValidationError(reply);
      const result = await updateProjectItem(
        database,
        session.user.id,
        projectId.data,
        itemId.data,
        input.data,
      );
      if (result.kind === "not-found")
        return reply
          .status(404)
          .send({ code: "ITEM_NOT_FOUND", message: "Este item não foi encontrado." });
      if (result.kind === "invalid-parent")
        return reply.status(400).send({
          code: "INVALID_PARENT",
          message: "Não é possível mover o item para essa pasta.",
        });
      request.log.info(
        { itemId: itemId.data, projectId: projectId.data, userId: session.user.id },
        "project item updated",
      );
      return serializeProjectItem(result.item);
    });

    app.delete("/api/projects/:projectId/items/:itemId", async (request, reply) => {
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const { projectId, itemId } = parseDocumentParams(request);
      if (!projectId.success || !itemId.success) return documentValidationError(reply);
      let result: Awaited<ReturnType<typeof deleteProjectItem>>;
      try {
        result = await deleteProjectItem(database, session.user.id, projectId.data, itemId.data);
      } catch (error) {
        request.log.error(
          { err: error, itemId: itemId.data, projectId: projectId.data, userId: session.user.id },
          "project item deletion failed",
        );
        return reply.status(500).send({
          code: "STORAGE_UNAVAILABLE",
          message: "Não foi possível excluir o item. Tente novamente.",
        });
      }
      if (result.kind === "project-not-found")
        return reply
          .status(404)
          .send({ code: "PROJECT_NOT_FOUND", message: "Este projeto não foi encontrado." });
      if (result.kind === "item-not-found")
        return reply
          .status(404)
          .send({ code: "ITEM_NOT_FOUND", message: "Este item não foi encontrado." });
      request.log.info(
        { itemId: itemId.data, projectId: projectId.data, userId: session.user.id },
        "project item deleted",
      );
      return reply.status(204).send();
    });

    app.get("/api/projects/:projectId/documents/:documentId", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const { projectId, documentId } = parseDocumentParams(request);
      if (!projectId.success || !documentId.success) return documentValidationError(reply);
      const result = await getDocument(database, session.user.id, projectId.data, documentId.data);
      if (!result)
        return reply
          .status(404)
          .send({ code: "DOCUMENT_NOT_FOUND", message: "Este documento não foi encontrado." });
      return { ...result, item: serializeProjectItem(result.item) };
    });

    app.get(
      "/api/projects/:projectId/documents/:documentId/export/markdown",
      async (request, reply) => {
        const session = await requireSession(auth, request, reply);
        if (!session) return;
        const { projectId, documentId } = parseDocumentParams(request);
        if (!projectId.success || !documentId.success) return documentValidationError(reply);
        const result = await getDocument(
          database,
          session.user.id,
          projectId.data,
          documentId.data,
        );
        if (!result)
          return reply
            .status(404)
            .send({ code: "DOCUMENT_NOT_FOUND", message: "Este documento não foi encontrado." });
        const markdown = await exportDocumentToMarkdown(result.content as DocumentBlock[]);
        const filename =
          result.item.title.replace(/[^\p{L}\p{N}._ -]+/gu, "").trim() || "documento";
        return reply
          .header("content-type", "text/markdown; charset=utf-8")
          .header(
            "content-disposition",
            `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.md`,
          )
          .header("x-content-type-options", "nosniff")
          .send(markdown);
      },
    );

    app.put(
      "/api/projects/:projectId/documents/:documentId/content",
      { bodyLimit: DOCUMENT_MAX_CONTENT_BYTES },
      async (request, reply) => {
        if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
        const session = await requireSession(auth, request, reply);
        if (!session) return;
        const { projectId, documentId } = parseDocumentParams(request);
        const input = saveDocumentContentSchema.safeParse(request.body);
        if (!projectId.success || !documentId.success || !input.success)
          return documentValidationError(reply);
        const result = await saveDocumentContent(
          database,
          session.user.id,
          projectId.data,
          documentId.data,
          input.data,
        );
        if (result.kind === "not-found")
          return reply
            .status(404)
            .send({ code: "DOCUMENT_NOT_FOUND", message: "Este documento não foi encontrado." });
        if (result.kind === "conflict")
          return reply.status(409).send({
            code: "DOCUMENT_REVISION_CONFLICT",
            message: "Este documento foi alterado em outra sessão.",
            revision: result.revision,
          });
        if (result.kind === "invalid-assets")
          return reply.status(400).send({
            code: "INVALID_DOCUMENT_ASSET",
            message: "Uma imagem não pertence a este documento.",
          });
        if (result.kind === "quota")
          return reply.status(409).send({
            code: "STORAGE_LIMIT_REACHED",
            message: "Seu limite de armazenamento foi atingido.",
          });
        request.log.info(
          {
            documentId: documentId.data,
            projectId: projectId.data,
            revision: result.revision,
            userId: session.user.id,
          },
          result.kind === "saved" ? "document saved" : "document save skipped",
        );
        return { revision: result.revision, updatedAt: result.updatedAt.toISOString() };
      },
    );
  };
