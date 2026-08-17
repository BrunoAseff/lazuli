import type { FastifyReply, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";

import type { Auth } from "./auth.ts";

export const requireSession = async (auth: Auth, request: FastifyRequest, reply: FastifyReply) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    await reply.status(401).send({
      code: "UNAUTHORIZED",
      message: "Você precisa entrar para acessar este recurso.",
    });
    return null;
  }

  return session;
};
