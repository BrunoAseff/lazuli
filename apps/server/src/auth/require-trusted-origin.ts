import type { FastifyReply, FastifyRequest } from "fastify";

export const requireTrustedOrigin = (
  websiteUrl: string,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const origin = request.headers.origin;

  if (!origin || origin !== new URL(websiteUrl).origin) {
    void reply.status(403).send({
      code: "UNTRUSTED_ORIGIN",
      message: "Não foi possível validar a origem desta solicitação.",
    });
    return false;
  }

  return true;
};
