import type { FastifyPluginAsync } from "fastify";
import { fromNodeHeaders } from "better-auth/node";

import type { ServerEnv } from "../config.ts";

type AuthHandler = {
  handler: (request: Request) => Promise<Response>;
};

export const createAuthRoutes = (auth: AuthHandler, env: ServerEnv): FastifyPluginAsync =>
  async function authRoutes(app) {
    app.route({
      method: ["GET", "POST"],
      url: "/api/auth/*",
      async handler(request, reply) {
        try {
          const url = new URL(request.url, env.BETTER_AUTH_URL);
          const headers = fromNodeHeaders(request.headers);
          headers.set("x-lazuli-client-ip", request.ip);
          const response = await auth.handler(
            new Request(url, {
              method: request.method,
              headers,
              ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
            }),
          );

          reply.status(response.status);

          response.headers.forEach((value, key) => {
            if (key !== "set-cookie") {
              reply.header(key, value);
            }
          });

          const cookies = response.headers.getSetCookie();
          if (cookies.length > 0) {
            reply.header("set-cookie", cookies);
          }

          return reply.send(response.body ? await response.text() : null);
        } catch (error) {
          request.log.error({ err: error }, "authentication request failed");
          return reply.status(500).send({
            code: "AUTH_FAILURE",
            message: "Não foi possível concluir a autenticação.",
          });
        }
      },
    });
  };
