import { projectIdSchema, projectItemIdSchema } from "@lazuli/shared";
import type { FastifyReply } from "fastify";

export const documentValidationError = (reply: FastifyReply) =>
  reply
    .status(400)
    .send({ code: "VALIDATION_ERROR", message: "Revise os dados informados e tente novamente." });

export const serializeProjectItem = <T extends { createdAt: Date; updatedAt: Date }>(item: T) => ({
  ...item,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

export const parseDocumentParams = (request: { params: unknown }) => {
  const raw = request.params as {
    projectId?: unknown;
    itemId?: unknown;
    documentId?: unknown;
    assetId?: unknown;
  };
  return {
    projectId: projectIdSchema.safeParse(raw.projectId),
    itemId: projectItemIdSchema.safeParse(raw.itemId),
    documentId: projectItemIdSchema.safeParse(raw.documentId),
    assetId: projectItemIdSchema.safeParse(raw.assetId),
  };
};
