import type { FastifyReply, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";

import type { Auth } from "./auth.ts";

const requestSessions = new WeakMap<FastifyRequest, ReturnType<Auth["api"]["getSession"]>>();

export const requireSession = async (auth: Auth, request: FastifyRequest, reply: FastifyReply) => {
  let pending = requestSessions.get(request);
  if (!pending) {
    pending = auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    requestSessions.set(request, pending);
  }
  const session = await pending;

  if (!session) {
    await reply.status(401).send({
      code: "UNAUTHORIZED",
      message: "Você precisa entrar para acessar este recurso.",
    });
    return null;
  }

  return session;
};
