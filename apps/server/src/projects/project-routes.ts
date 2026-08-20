import {
  createProjectSchema,
  projectIdSchema,
  projectListQuerySchema,
  updateProjectSchema,
} from "@lazuli/shared";
import type { FastifyPluginAsync, FastifyReply } from "fastify";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import { requireTrustedOrigin } from "../auth/require-trusted-origin.ts";
import type { Database } from "../database/client.ts";
import { deleteObjectBatch } from "../storage/delete-object-batch.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";
import {
  createProject,
  deleteProject,
  getProject,
  listProjectDocuments,
  listProjects,
  updateProject,
} from "./project-queries.ts";

type ProjectRoutesOptions = {
  auth: Auth;
  database: Database;
  storage: ObjectStorage;
  websiteUrl: string;
};

const sendValidationError = (reply: FastifyReply) =>
  reply.status(400).send({
    code: "VALIDATION_ERROR",
    message: "Revise os dados informados e tente novamente.",
  });

const serializeProject = (value: NonNullable<Awaited<ReturnType<typeof getProject>>>) => ({
  ...value,
  createdAt: value.createdAt.toISOString(),
  updatedAt: value.updatedAt.toISOString(),
});

export const createProjectRoutes = ({
  auth,
  database,
  storage,
  websiteUrl,
}: ProjectRoutesOptions): FastifyPluginAsync =>
  async function projectRoutes(app) {
    app.get("/api/projects", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;

      const query = projectListQuerySchema.safeParse(request.query);
      if (!query.success) return sendValidationError(reply);

      try {
        const result = await listProjects(database, session.user.id, query.data);
        request.log.info(
          { page: query.data.page, resultCount: result.items.length, userId: session.user.id },
          "projects listed",
        );
        return {
          ...result,
          items: result.items.map(serializeProject),
        };
      } catch (error) {
        request.log.error({ err: error, userId: session.user.id }, "project listing failed");
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível carregar seus projetos.",
        });
      }
    });

    app.post("/api/projects", async (request, reply) => {
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
      const session = await requireSession(auth, request, reply);
      if (!session) return;

      const input = createProjectSchema.safeParse(request.body);
      if (!input.success) return sendValidationError(reply);

      try {
        const result = await createProject(database, session.user.id, input.data);
        if (!result?.project) {
          return reply.status(409).send({
            code: "PROJECT_CREATE_CONFLICT",
            message: "Não foi possível concluir esta criação. Tente novamente.",
          });
        }

        request.log.info(
          { created: result.created, projectId: result.project.id, userId: session.user.id },
          "project creation completed",
        );
        return reply.status(result.created ? 201 : 200).send(serializeProject(result.project));
      } catch (error) {
        request.log.error({ err: error, userId: session.user.id }, "project creation failed");
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível criar o projeto.",
        });
      }
    });

    app.get("/api/projects/:projectId", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;

      const projectId = projectIdSchema.safeParse(
        (request.params as { projectId?: unknown }).projectId,
      );
      if (!projectId.success) return sendValidationError(reply);

      try {
        const result = await getProject(database, session.user.id, projectId.data);
        if (!result) {
          return reply.status(404).send({
            code: "PROJECT_NOT_FOUND",
            message: "Este projeto não foi encontrado.",
          });
        }
        return serializeProject(result);
      } catch (error) {
        request.log.error(
          { err: error, projectId: projectId.data, userId: session.user.id },
          "project detail failed",
        );
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível carregar o projeto.",
        });
      }
    });

    app.patch("/api/projects/:projectId", async (request, reply) => {
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
      const session = await requireSession(auth, request, reply);
      if (!session) return;

      const projectId = projectIdSchema.safeParse(
        (request.params as { projectId?: unknown }).projectId,
      );
      const input = updateProjectSchema.safeParse(request.body);
      if (!projectId.success || !input.success) return sendValidationError(reply);

      try {
        const result = await updateProject(database, session.user.id, projectId.data, input.data);
        if (!result) {
          return reply.status(404).send({
            code: "PROJECT_NOT_FOUND",
            message: "Este projeto não foi encontrado.",
          });
        }

        request.log.info({ projectId: projectId.data, userId: session.user.id }, "project updated");
        return serializeProject(result);
      } catch (error) {
        request.log.error(
          { err: error, projectId: projectId.data, userId: session.user.id },
          "project update failed",
        );
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível atualizar o projeto.",
        });
      }
    });

    app.delete("/api/projects/:projectId", async (request, reply) => {
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
      const session = await requireSession(auth, request, reply);
      if (!session) return;

      const projectId = projectIdSchema.safeParse(
        (request.params as { projectId?: unknown }).projectId,
      );
      if (!projectId.success) return sendValidationError(reply);

      try {
        const deleted = await deleteProject(database, session.user.id, projectId.data, (keys) =>
          deleteObjectBatch(storage, keys),
        );
        request.log.info(
          { deleted, projectId: projectId.data, userId: session.user.id },
          "project deletion completed",
        );
        return reply.status(204).send();
      } catch (error) {
        request.log.error(
          { err: error, projectId: projectId.data, userId: session.user.id },
          "project deletion failed",
        );
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível excluir o projeto.",
        });
      }
    });

    app.get("/api/projects/:projectId/documents", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;

      const projectId = projectIdSchema.safeParse(
        (request.params as { projectId?: unknown }).projectId,
      );
      const query = projectListQuerySchema.safeParse(request.query);
      if (!projectId.success || !query.success) return sendValidationError(reply);

      try {
        const result = await listProjectDocuments(
          database,
          session.user.id,
          projectId.data,
          query.data,
        );
        if (!result) {
          return reply.status(404).send({
            code: "PROJECT_NOT_FOUND",
            message: "Este projeto não foi encontrado.",
          });
        }

        return {
          ...result,
          items: result.items.map((item) => ({
            ...item,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          })),
        };
      } catch (error) {
        request.log.error(
          { err: error, projectId: projectId.data, userId: session.user.id },
          "document listing failed",
        );
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível carregar os documentos.",
        });
      }
    });
  };
