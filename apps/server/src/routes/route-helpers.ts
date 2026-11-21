import type { FastifyReply, FastifyRequest } from "fastify";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import { requireTrustedOrigin } from "../auth/require-trusted-origin.ts";
import type { RequestRateLimiter } from "../security/request-rate-limiter.ts";

/**
 * An unexpected failure: logged with what identifies the request, answered with a message the
 * person can read and nothing internal.
 */
export const sendInternalError = (
  request: FastifyRequest,
  reply: FastifyReply,
  message: string,
  context: Record<string, unknown>,
  log: string,
) => {
  request.log.error(context, log);
  return reply.status(500).send({ code: "INTERNAL_ERROR", message });
};

export const sendValidationError = (reply: FastifyReply) =>
  reply.status(400).send({
    code: "VALIDATION_ERROR",
    message: "Revise os dados informados e tente novamente.",
  });

export const createMutationAuthorizer = (
  auth: Auth,
  websiteUrl: string,
  limiter: RequestRateLimiter,
  rateLimitError: { code: string; message: string } = {
    code: "RATE_LIMITED",
    message: "Muitas alterações foram feitas em pouco tempo. Aguarde e tente novamente.",
  },
) =>
  async function authorizeMutation(
    request: Parameters<typeof requireSession>[1],
    reply: FastifyReply,
  ) {
    if (!requireTrustedOrigin(websiteUrl, request, reply)) return null;
    const session = await requireSession(auth, request, reply);
    if (!session) return null;
    if (!limiter.consume(session.user.id)) {
      reply.status(429).send(rateLimitError);
      return null;
    }
    return session;
  };
