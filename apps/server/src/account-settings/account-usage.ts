import { accountUsageSchema } from "@lazuli/shared";
import { eq, sql } from "drizzle-orm";
import type { Database } from "../database/client.ts";
import { user, billingSubscription } from "../database/schema/index.ts";
import { getCommercialSummary } from "../commercial/commercial-service.ts";
import { resolveEffectiveEntitlement } from "../commercial/commercial-entitlements.ts";
import { getAnchoredMonthlyPeriod } from "../commercial/commercial-credits.ts";

export const getAccountUsage = async (database: Database, userId: string) => {
  const now = new Date();
  const [commercial, entitlement, owners, subscriptions] = await Promise.all([
    getCommercialSummary(database, userId),
    resolveEffectiveEntitlement(database, userId, now),
    database.select({ createdAt: user.createdAt }).from(user).where(eq(user.id, userId)).limit(1),
    database
      .select()
      .from(billingSubscription)
      .where(eq(billingSubscription.userId, userId))
      .limit(1),
  ]);
  const subscription = subscriptions[0];
  const period =
    entitlement.source === "stripe" &&
    subscription?.currentPeriodStart &&
    subscription.currentPeriodEnd
      ? { start: subscription.currentPeriodStart, end: subscription.currentPeriodEnd }
      : getAnchoredMonthlyPeriod(entitlement.periodAnchor ?? owners[0]?.createdAt ?? now, now);
  const [totals] = await database.execute(sql`select
    (select count(*)::int from project where user_id=${userId}) as projects,
    (select count(*)::int from project_item d join project p on p.id=d.project_id where p.user_id=${userId} and d.type='document') as documents,
    (select count(*)::int from flashcard_collection where user_id=${userId} and archived_at is null) as "flashcardCollections",
    (select count(*)::int from flashcard_collection where user_id=${userId} and archived_at is not null) as "archivedFlashcardCollections",
    (select count(*)::int from flashcard d join flashcard_collection c on c.id=d.collection_id where c.user_id=${userId} and c.archived_at is null and d.archived_at is null) as flashcards,
    (select count(*)::int from quiz_collection where user_id=${userId} and archived_at is null) as quizzes,
    (select count(*)::int from quiz_collection where user_id=${userId} and archived_at is not null) as "archivedQuizzes",
    (select count(*)::int from quiz_question d join quiz_collection c on c.id=d.collection_id where c.user_id=${userId} and c.archived_at is null and d.archived_at is null) as questions,
    (select coalesce(sum(amount),0)::int from ai_credit_ledger where user_id=${userId} and type='consume' and created_at>=${period.start.toISOString()} and created_at<${period.end.toISOString()}) as consumed`);
  return accountUsageSchema.parse({
    commercial,
    library: totals,
    cycle: {
      startsAt: period.start.toISOString(),
      endsAt: period.end.toISOString(),
      consumed: totals?.consumed ?? 0,
    },
  });
};
