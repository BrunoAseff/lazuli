import { COMMERCIAL_PLAN_CATALOG, type BillingSubscriptionStatus } from "@lazuli/shared";
import { and, asc, eq, gt, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import Stripe from "stripe";

import { grantCreditBucket } from "../ai-credits/ai-credit-buckets.ts";
import { lockAiCreditAccount } from "../ai-credits/ai-credit-transactions.ts";
import type { ServerEnv } from "../config.ts";
import type { Database, Transaction } from "../database/client.ts";
import {
  billingCustomer,
  billingSubscription,
  billingWebhookEvent,
  aiCreditBucket,
  user,
} from "../database/schema/index.ts";

type PaidPlan = "essential" | "specialist";

const ACTIVE_SUBSCRIPTION_STATUS_VALUES: BillingSubscriptionStatus[] = [
  "active",
  "past_due",
  "trialing",
];
const ACTIVE_SUBSCRIPTION_STATUSES = new Set<string>(ACTIVE_SUBSCRIPTION_STATUS_VALUES);
const WEBHOOK_PROCESSING_STALE_MS = 10 * 60 * 1_000;

const getStripeEnvironment = (secretKey: string) =>
  secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_") ? "live" : "test";

const getAccessUntil = ({
  eventCreatedAt,
  graceDays,
  periodEnd,
  previous,
  status,
}: {
  eventCreatedAt: Date;
  graceDays: number;
  periodEnd: Date | null;
  previous: typeof billingSubscription.$inferSelect | undefined;
  status: Stripe.Subscription.Status;
}) => {
  if (status === "active" || status === "trialing") return periodEnd;
  if (status !== "past_due") return null;
  if (previous?.status === "past_due" && previous.accessUntil) return previous.accessUntil;
  return new Date(eventCreatedAt.getTime() + graceDays * 24 * 60 * 60 * 1_000);
};

const getPeriod = (subscription: Stripe.Subscription) => {
  const item = subscription.items.data[0];
  return {
    start: item ? new Date(item.current_period_start * 1000) : null,
    end: item ? new Date(item.current_period_end * 1000) : null,
  };
};

// Stripe may represent a cancellation scheduled for the end of the current
// period either through `cancel_at_period_end` or through an explicit
// `cancel_at` timestamp (the Customer Portal currently uses the latter for
// some cancellation flows). The application contract intentionally exposes a
// single semantic flag regardless of which Stripe representation was used.
export const hasScheduledStripeCancellation = (subscription: Stripe.Subscription) =>
  subscription.cancel_at_period_end ||
  (ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status) && subscription.cancel_at !== null);

export const createStripeBillingService = (env: ServerEnv, database: Database) => {
  if (!env.BILLING_ENABLED) return null;
  const stripe = new Stripe(env.STRIPE_SECRET_KEY!);
  const environment = getStripeEnvironment(env.STRIPE_SECRET_KEY!);
  const prices: Record<PaidPlan, string> = {
    essential: env.STRIPE_ESSENTIAL_PRICE_ID!,
    specialist: env.STRIPE_SPECIALIST_PRICE_ID!,
  };
  const getReturnUrl = (returnTo = "/flashcards", billing?: "canceled" | "portal" | "success") => {
    const url = new URL(returnTo, env.WEBSITE_URL);
    if (url.origin !== new URL(env.WEBSITE_URL).origin)
      throw new Error("Billing return path must use the website origin");
    if (billing) url.searchParams.set("billing", billing);
    return url.toString();
  };

  const planFromPrice = (priceId: string): PaidPlan | null => {
    if (priceId === prices.essential) return "essential";
    if (priceId === prices.specialist) return "specialist";
    return null;
  };

  const ensureCustomer = async (userId: string) => {
    const [existing] = await database
      .select()
      .from(billingCustomer)
      .where(eq(billingCustomer.userId, userId))
      .limit(1);
    if (existing) {
      if (existing.environment !== environment)
        throw new Error("Stripe environment does not match the existing billing customer");
      return existing.stripeCustomerId;
    }
    const [owner] = await database.select().from(user).where(eq(user.id, userId)).limit(1);
    if (!owner) throw new Error("Billing user was not found");
    const customer = await stripe.customers.create({
      email: owner.email,
      name: owner.name,
      metadata: { lazuliUserId: userId },
    });
    const [inserted] = await database
      .insert(billingCustomer)
      .values({ environment, userId, stripeCustomerId: customer.id })
      .onConflictDoNothing({ target: billingCustomer.userId })
      .returning();
    if (inserted) return customer.id;
    const [winner] = await database
      .select()
      .from(billingCustomer)
      .where(eq(billingCustomer.userId, userId))
      .limit(1);
    if (!winner) throw new Error("Billing customer race could not be resolved");
    // Avoid retaining a duplicate customer produced by a rare concurrent request.
    await stripe.customers.del(customer.id);
    if (winner.environment !== environment)
      throw new Error("Stripe environment does not match the winning billing customer");
    return winner.stripeCustomerId;
  };

  const syncSubscription = async (
    tx: Transaction,
    subscription: Stripe.Subscription,
    eventCreatedAt: Date,
    eventId: string,
  ) => {
    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    const [customer] = await tx
      .select()
      .from(billingCustomer)
      .where(eq(billingCustomer.stripeCustomerId, customerId))
      .limit(1);
    const metadataUserId = subscription.metadata.lazuliUserId;
    const resolvedUserId = customer?.userId ?? metadataUserId;
    if (!resolvedUserId) throw new Error("Stripe subscription has no Lazúli owner");
    if (customer && customer.environment !== environment)
      throw new Error("Stripe webhook environment does not match the billing customer");
    const userId: string = resolvedUserId;
    if (!customer)
      await tx
        .insert(billingCustomer)
        .values({ environment, userId, stripeCustomerId: customerId })
        .onConflictDoNothing({ target: billingCustomer.userId });
    const priceId = subscription.items.data[0]?.price.id;
    const plan = priceId ? planFromPrice(priceId) : null;
    if (!priceId || !plan) throw new Error(`Unknown Stripe price ${priceId ?? "missing"}`);
    const period = getPeriod(subscription);
    const [previous] = await tx
      .select()
      .from(billingSubscription)
      .where(eq(billingSubscription.userId, userId))
      .limit(1)
      .for("update");
    if (previous && previous.environment !== environment)
      throw new Error("Stripe webhook environment does not match the billing subscription");
    if (previous && previous.providerUpdatedAt > eventCreatedAt) return { previous, plan, userId };
    const accessUntil = getAccessUntil({
      eventCreatedAt,
      graceDays: env.BILLING_PAYMENT_GRACE_DAYS,
      periodEnd: period.end,
      previous,
      status: subscription.status,
    });
    await tx
      .insert(billingSubscription)
      .values({
        userId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        environment,
        plan,
        status: subscription.status as BillingSubscriptionStatus,
        cancelAtPeriodEnd: hasScheduledStripeCancellation(subscription),
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        accessUntil,
        endedAt: subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
        lastStripeEventId: eventId,
        providerUpdatedAt: eventCreatedAt,
      })
      .onConflictDoUpdate({
        target: billingSubscription.userId,
        set: {
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          environment,
          plan,
          status: subscription.status as BillingSubscriptionStatus,
          cancelAtPeriodEnd: hasScheduledStripeCancellation(subscription),
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
          accessUntil,
          endedAt: subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
          lastStripeEventId: eventId,
          providerUpdatedAt: eventCreatedAt,
          updatedAt: new Date(),
        },
        setWhere: lte(billingSubscription.providerUpdatedAt, eventCreatedAt),
      });
    return { previous, plan, userId };
  };

  const grantInvoiceCredits = async (
    tx: Transaction,
    subscription: Stripe.Subscription,
    plan: PaidPlan,
    userId: string,
  ) => {
    if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) return;
    const period = getPeriod(subscription);
    if (!period.start || !period.end) throw new Error("Stripe subscription period is missing");
    await lockAiCreditAccount(tx, userId);
    const overlappingBuckets = await tx
      .select({ plan: aiCreditBucket.plan })
      .from(aiCreditBucket)
      .where(
        and(
          eq(aiCreditBucket.userId, userId),
          eq(aiCreditBucket.origin, "monthly"),
          lte(aiCreditBucket.startsAt, period.end),
          or(isNull(aiCreditBucket.expiresAt), gt(aiCreditBucket.expiresAt, period.start)),
        ),
      )
      .for("update");
    const alreadyGrantedAllowance = overlappingBuckets.reduce((maximum, bucket) => {
      const bucketPlan = bucket.plan;
      if (!bucketPlan || !(bucketPlan in COMMERCIAL_PLAN_CATALOG)) return maximum;
      return Math.max(
        maximum,
        COMMERCIAL_PLAN_CATALOG[bucketPlan as keyof typeof COMMERCIAL_PLAN_CATALOG]
          .monthlyAiCredits,
      );
    }, 0);
    const amount = Math.max(
      0,
      COMMERCIAL_PLAN_CATALOG[plan].monthlyAiCredits - alreadyGrantedAllowance,
    );
    if (amount === 0) return;
    await grantCreditBucket(tx, {
      actorId: "stripe-webhook",
      actorType: "system",
      amount,
      expiresAt: period.end,
      idempotencyKey: `stripe:period:${subscription.id}:${period.start.toISOString()}:${plan}`,
      origin: "monthly",
      plan,
      reason: `Créditos mensais do plano ${plan}`,
      sourceId: subscription.id,
      startsAt: period.start,
      userId,
    });
  };

  const getInvoiceSubscriptionId = (invoice: Stripe.Invoice) => {
    const subscription = invoice.parent?.subscription_details?.subscription;
    return typeof subscription === "string" ? subscription : (subscription?.id ?? null);
  };

  const enqueueWebhookEvent = async (event: Stripe.Event) => {
    await database
      .insert(billingWebhookEvent)
      .values({
        stripeEventId: event.id,
        type: event.type,
        providerCreatedAt: new Date(event.created * 1000),
      })
      .onConflictDoNothing({ target: billingWebhookEvent.stripeEventId });
  };

  const claimWebhookEvent = async (event: Stripe.Event) =>
    database.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(billingWebhookEvent)
        .where(eq(billingWebhookEvent.stripeEventId, event.id))
        .limit(1)
        .for("update");
      if (!existing || existing.status === "processed") return false;
      const staleBefore = new Date(Date.now() - WEBHOOK_PROCESSING_STALE_MS);
      if (existing.status === "processing" && existing.updatedAt > staleBefore) return false;
      const claimed = await tx
        .update(billingWebhookEvent)
        .set({
          status: "processing",
          attempts: sql`${billingWebhookEvent.attempts} + 1`,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(billingWebhookEvent.stripeEventId, event.id),
            or(
              inArray(billingWebhookEvent.status, ["pending", "failed"]),
              and(
                eq(billingWebhookEvent.status, "processing"),
                lte(billingWebhookEvent.updatedAt, staleBefore),
              ),
            ),
          ),
        )
        .returning({ id: billingWebhookEvent.stripeEventId });
      return claimed.length === 1;
    });

  const resolveEventSubscription = async (event: Stripe.Event) => {
    if (event.type.startsWith("customer.subscription."))
      return event.data.object as Stripe.Subscription;
    if (
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_failed" ||
      event.type === "invoice.payment_action_required"
    ) {
      const subscriptionId = getInvoiceSubscriptionId(event.data.object as Stripe.Invoice);
      return subscriptionId ? stripe.subscriptions.retrieve(subscriptionId) : null;
    }
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      return subscriptionId ? stripe.subscriptions.retrieve(subscriptionId) : null;
    }
    return null;
  };

  const createPortalSessionForCustomer = async (customer: string, returnTo?: string) => {
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: getReturnUrl(returnTo, "portal"),
    });
    return { destination: "portal" as const, url: session.url };
  };

  const createPortalSession = async (userId: string, returnTo?: string) =>
    createPortalSessionForCustomer(await ensureCustomer(userId), returnTo);

  const processEvent = async (event: Stripe.Event) => {
    if (!(await claimWebhookEvent(event))) return false;
    try {
      const subscription = await resolveEventSubscription(event);
      await database.transaction(async (tx) => {
        if (event.type.startsWith("customer.subscription.")) {
          if (!subscription) throw new Error("Stripe subscription payload is missing");
          await syncSubscription(tx, subscription, new Date(event.created * 1000), event.id);
        } else if (event.type === "invoice.paid") {
          if (subscription) {
            const synced = await syncSubscription(
              tx,
              subscription,
              new Date(event.created * 1000),
              event.id,
            );
            await grantInvoiceCredits(tx, subscription, synced.plan, synced.userId);
          }
        } else if (
          event.type === "invoice.payment_failed" ||
          event.type === "invoice.payment_action_required"
        ) {
          if (subscription)
            await syncSubscription(tx, subscription, new Date(event.created * 1000), event.id);
        } else if (event.type === "checkout.session.completed") {
          if (subscription)
            await syncSubscription(tx, subscription, new Date(event.created * 1000), event.id);
        }
        await tx
          .update(billingWebhookEvent)
          .set({
            status: "processed",
            processedAt: new Date(),
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(billingWebhookEvent.stripeEventId, event.id));
      });
      return true;
    } catch (error) {
      await database
        .update(billingWebhookEvent)
        .set({
          status: "failed",
          // Provider and database errors may contain operational details. Keep
          // those in the structured server log, not in persisted user-facing
          // state or tooling output.
          lastError: "STRIPE_EVENT_PROCESSING_FAILED",
          updatedAt: new Date(),
        })
        .where(eq(billingWebhookEvent.stripeEventId, event.id));
      throw error;
    }
  };

  return {
    stripe,
    async createCheckout(userId: string, plan: PaidPlan, returnTo?: string) {
      const customer = await ensureCustomer(userId);
      return database.transaction(async (tx) => {
        // Keep the local check, Stripe check and session creation serialized per
        // user, including across API replicas. Stripe remains the final guard
        // while a webhook has not materialized the subscription locally yet.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`billing-checkout:${userId}`}))`,
        );
        const [current] = await tx
          .select({ id: billingSubscription.stripeSubscriptionId })
          .from(billingSubscription)
          .where(
            and(
              eq(billingSubscription.userId, userId),
              inArray(billingSubscription.status, ACTIVE_SUBSCRIPTION_STATUS_VALUES),
            ),
          )
          .limit(1);
        if (current) return createPortalSessionForCustomer(customer, returnTo);

        const subscriptions = await stripe.subscriptions.list({
          customer,
          limit: 100,
          status: "all",
        });
        if (
          subscriptions.data.some((subscription) =>
            ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status),
          )
        )
          return createPortalSessionForCustomer(customer, returnTo);

        const openSessions = await stripe.checkout.sessions.list({
          customer,
          limit: 100,
          status: "open",
        });
        const existing = openSessions.data.find(
          (session) =>
            session.mode === "subscription" &&
            session.metadata?.lazuliUserId === userId &&
            session.metadata.plan === plan &&
            session.url,
        );
        if (existing?.url) return { destination: "checkout" as const, url: existing.url };

        const window = Math.floor(Date.now() / (10 * 60 * 1000));
        const session = await stripe.checkout.sessions.create(
          {
            mode: "subscription",
            customer,
            line_items: [{ price: prices[plan], quantity: 1 }],
            allow_promotion_codes: true,
            client_reference_id: userId,
            metadata: { lazuliUserId: userId, plan },
            subscription_data: { metadata: { lazuliUserId: userId, plan } },
            success_url: getReturnUrl(returnTo, "success"),
            cancel_url: getReturnUrl(returnTo, "canceled"),
          },
          { idempotencyKey: `lazuli:checkout:${userId}:${plan}:${window}` },
        );
        if (!session.url) throw new Error("Stripe checkout did not return a URL");
        return { destination: "checkout" as const, url: session.url };
      });
    },
    async createPortal(userId: string, returnTo?: string) {
      return createPortalSession(userId, returnTo);
    },
    async refreshSubscription(userId: string) {
      const [customer, current] = await Promise.all([
        database
          .select({
            environment: billingCustomer.environment,
            stripeCustomerId: billingCustomer.stripeCustomerId,
          })
          .from(billingCustomer)
          .where(eq(billingCustomer.userId, userId))
          .limit(1),
        database
          .select({
            environment: billingSubscription.environment,
            stripeSubscriptionId: billingSubscription.stripeSubscriptionId,
          })
          .from(billingSubscription)
          .where(eq(billingSubscription.userId, userId))
          .limit(1),
      ]);
      const billingOwner = customer[0];
      const storedSubscription = current[0];
      if (!billingOwner) return false;
      if (
        billingOwner.environment !== environment ||
        (storedSubscription && storedSubscription.environment !== environment)
      )
        throw new Error("Stripe environment does not match the billing account");

      let subscription: Stripe.Subscription | undefined;
      if (storedSubscription)
        subscription = await stripe.subscriptions.retrieve(storedSubscription.stripeSubscriptionId);
      else {
        const subscriptions = await stripe.subscriptions.list({
          customer: billingOwner.stripeCustomerId,
          limit: 100,
          status: "all",
        });
        subscription =
          subscriptions.data.find((item) => ACTIVE_SUBSCRIPTION_STATUSES.has(item.status)) ??
          subscriptions.data.sort((left, right) => right.created - left.created)[0];
      }
      if (!subscription) return false;

      const refreshedAt = new Date();
      await database.transaction((tx) =>
        syncSubscription(
          tx,
          subscription,
          refreshedAt,
          `direct-refresh:${subscription.id}:${refreshedAt.getTime()}`,
        ),
      );
      return true;
    },
    constructEvent(rawBody: Buffer, signature: string) {
      return stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET!);
    },
    async enqueueEvent(event: Stripe.Event) {
      await enqueueWebhookEvent(event);
    },
    processEvent,
    async retryPendingEvents(limit = 25) {
      const staleBefore = new Date(Date.now() - WEBHOOK_PROCESSING_STALE_MS);
      const events = await database
        .select({ id: billingWebhookEvent.stripeEventId })
        .from(billingWebhookEvent)
        .where(
          and(
            or(
              inArray(billingWebhookEvent.status, ["pending", "failed"]),
              and(
                eq(billingWebhookEvent.status, "processing"),
                lte(billingWebhookEvent.updatedAt, staleBefore),
              ),
            ),
            lt(billingWebhookEvent.attempts, 10),
          ),
        )
        .orderBy(asc(billingWebhookEvent.receivedAt))
        .limit(limit);
      let processed = 0;
      for (const stored of events) {
        const event = await stripe.events.retrieve(stored.id);
        if (await processEvent(event)) processed += 1;
      }
      return processed;
    },
    async reconcileSubscriptions(limit = 100) {
      const customers: Array<{ id: string }> = [];
      let cursor: string | null = null;
      while (customers.length < limit) {
        const pageSize = Math.min(100, limit - customers.length);
        const page = await database
          .select({ id: billingCustomer.stripeCustomerId })
          .from(billingCustomer)
          .where(
            and(
              eq(billingCustomer.environment, environment),
              cursor ? gt(billingCustomer.stripeCustomerId, cursor) : undefined,
            ),
          )
          .orderBy(asc(billingCustomer.stripeCustomerId))
          .limit(pageSize);
        customers.push(...page);
        if (page.length < pageSize) break;
        cursor = page.at(-1)!.id;
      }
      let reconciled = 0;
      const issues: Array<{ customerId: string; code: string }> = [];
      for (const customer of customers) {
        const result = await stripe.subscriptions.list({
          customer: customer.id,
          limit: 100,
          status: "all",
        });
        const active = result.data.filter((subscription) =>
          ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status),
        );
        if (active.length > 1) {
          issues.push({ code: "MULTIPLE_ACTIVE_SUBSCRIPTIONS", customerId: customer.id });
          continue;
        }
        const subscription =
          active[0] ?? result.data.sort((left, right) => right.created - left.created)[0];
        if (!subscription) continue;
        await database.transaction((tx) =>
          syncSubscription(
            tx,
            subscription,
            new Date(),
            `reconcile:${subscription.id}:${Date.now()}`,
          ),
        );
        reconciled += 1;
      }
      return { issues, reconciled };
    },
  };
};

export type StripeBillingService = NonNullable<ReturnType<typeof createStripeBillingService>>;
