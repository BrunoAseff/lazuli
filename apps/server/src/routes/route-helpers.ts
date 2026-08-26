import type { FastifyReply } from "fastify";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import { requireTrustedOrigin } from "../auth/require-trusted-origin.ts";
import type { RequestRateLimiter } from "../security/request-rate-limiter.ts";

export const sendValidationError = (reply: FastifyReply) =>
  reply.status(400).send({
    code: "VALIDATION_ERROR",
    message: "Revise os dados informados e tente novamente.",
  });

export const createMutationAuthorizer = (
  auth: Auth,
  websiteUrl: string,
  limiter: RequestRateLimiter,
) =>
  async function authorizeMutation(
    request: Parameters<typeof requireSession>[1],
    reply: FastifyReply,
  ) {
    if (!requireTrustedOrigin(websiteUrl, request, reply)) return null;
    const session = await requireSession(auth, request, reply);
    if (!session) return null;
    if (!limiter.consume(session.user.id)) {
      reply.status(429).send({
        code: "RATE_LIMITED",
        message: "Muitas alterações foram feitas em pouco tempo. Aguarde e tente novamente.",
      });
      return null;
    }
    return session;
  };
