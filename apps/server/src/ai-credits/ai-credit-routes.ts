import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import type { Auth } from "../auth/auth.ts";
import { requireSession } from "../auth/require-session.ts";
import type { AiCreditService } from "./ai-credit-service.ts";

const ledgerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const createAiCreditRoutes = ({
  auth,
  service,
}: {
  auth: Auth;
  service: Pick<AiCreditService, "getBalance" | "listLedger">;
}): FastifyPluginAsync =>
  async function aiCreditRoutes(app) {
    app.get("/api/ai/credits", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      return service.getBalance(session.user.id);
    });

    app.get("/api/ai/credits/ledger", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const query = ledgerQuerySchema.safeParse(request.query);
      if (!query.success)
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: "Revise os dados informados e tente novamente.",
        });
      const result = await service.listLedger(session.user.id, query.data);
      return {
        ...result,
        items: result.items.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        })),
        page: query.data.page,
        pageSize: query.data.pageSize,
      };
    });
  };
