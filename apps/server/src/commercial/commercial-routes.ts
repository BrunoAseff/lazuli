import {
  COMMERCIAL_PLAN_CATALOG,
  createCheckoutSessionSchema,
  createPortalSessionSchema,
} from "@lazuli/shared";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type Stripe from "stripe";

import type { Auth } from "../auth/auth.ts";
import type { AnalyticsService } from "../analytics/analytics-service.ts";
import { requireSession } from "../auth/require-session.ts";
import { requireTrustedOrigin } from "../auth/require-trusted-origin.ts";
import type { Database } from "../database/client.ts";
import { sendValidationError } from "../routes/route-helpers.ts";
import { getCommercialSummary } from "./commercial-service.ts";
import type { StripeBillingService } from "./stripe-billing-service.ts";

type Options = {
  analytics?: AnalyticsService;
  auth: Auth;
  database: Database;
  stripe: StripeBillingService | null;
  websiteUrl: string;
};

const sendBillingUnavailable = (reply: FastifyReply) =>
  reply.status(503).send({
    code: "BILLING_UNAVAILABLE",
    message: "A cobrança está temporariamente indisponível.",
  });

const runBillingAction = async <Result>(
  request: FastifyRequest,
  reply: FastifyReply,
  action: () => Promise<Result>,
) => {
  try {
    return await action();
  } catch (error) {
    request.log.error({ err: error }, "Stripe billing action failed");
    return sendBillingUnavailable(reply);
  }
};

export const createCommercialRoutes = ({
  analytics,
  auth,
  database,
  stripe,
  websiteUrl,
}: Options): FastifyPluginAsync =>
  async function commercialRoutes(app) {
    app.get("/api/billing/plans", async () => ({
      items: Object.values(COMMERCIAL_PLAN_CATALOG).sort((left, right) => left.order - right.order),
    }));

    app.get("/api/billing/summary", async (request, reply) => {
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      return getCommercialSummary(database, session.user.id);
    });

    app.post("/api/billing/summary/refresh", async (request, reply) => {
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      if (!stripe) return sendBillingUnavailable(reply);
      const refreshed = await runBillingAction(request, reply, () =>
        stripe.refreshSubscription(session.user.id),
      );
      if (typeof refreshed !== "boolean") return refreshed;
      return getCommercialSummary(database, session.user.id);
    });

    app.post("/api/billing/checkout-sessions", async (request, reply) => {
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const input = createCheckoutSessionSchema.safeParse(request.body);
      if (!input.success) return sendValidationError(reply);
      if (!stripe) return sendBillingUnavailable(reply);
      const result = await runBillingAction(request, reply, () =>
        stripe.createCheckout(session.user.id, input.data.plan, input.data.returnTo),
      );
      if (
        result &&
        typeof result === "object" &&
        "destination" in result &&
        result.destination === "checkout"
      )
        await analytics?.capture(session.user.id, "checkout_started", {
          plan: input.data.plan,
        });
      return result;
    });

    app.post("/api/billing/portal-sessions", async (request, reply) => {
      if (!requireTrustedOrigin(websiteUrl, request, reply)) return;
      const session = await requireSession(auth, request, reply);
      if (!session) return;
      const input = createPortalSessionSchema.safeParse(request.body);
      if (!input.success) return sendValidationError(reply);
      if (!stripe) return sendBillingUnavailable(reply);
      return runBillingAction(request, reply, () =>
        stripe.createPortal(session.user.id, input.data.returnTo),
      );
    });

    app.post(
      "/api/billing/webhooks/stripe",
      { bodyLimit: 1024 * 1024, config: { rawBody: true } },
      async (request, reply) => {
        if (!stripe)
          return reply.status(503).send({ code: "BILLING_UNAVAILABLE", message: "Unavailable" });
        const signature = request.headers["stripe-signature"];
        const rawBody = (request as typeof request & { rawBody?: Buffer }).rawBody;
        if (typeof signature !== "string" || !rawBody)
          return reply.status(400).send({ code: "INVALID_STRIPE_SIGNATURE", message: "Invalid" });
        let event: Stripe.Event;
        try {
          event = stripe.constructEvent(rawBody, signature);
        } catch (error) {
          request.log.warn({ err: error }, "Stripe webhook signature rejected");
          return reply.status(400).send({ code: "INVALID_STRIPE_SIGNATURE", message: "Invalid" });
        }
        try {
          await stripe.enqueueEvent(event);
          setImmediate(() => {
            void stripe.processEvent(event).catch((error: unknown) => {
              request.log.error({ err: error, stripeEventId: event.id }, "Stripe event failed");
            });
          });
          return reply.status(200).send({ received: true });
        } catch (error) {
          request.log.error(
            { err: error, stripeEventId: event.id },
            "Stripe webhook enqueue failed",
          );
          return reply
            .status(500)
            .send({ code: "STRIPE_WEBHOOK_UNAVAILABLE", message: "Unavailable" });
        }
      },
    );
  };
