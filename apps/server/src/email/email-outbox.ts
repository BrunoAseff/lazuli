import { and, eq, sql } from "drizzle-orm";
import type { Database, QueryExecutor } from "../database/client.ts";
import { emailOutbox, user } from "../database/schema/index.ts";
import type { LifecycleEmailKind, LifecycleEmailPayload } from "./lifecycle-email.ts";

export const enqueueLifecycleEmail = async (
  database: QueryExecutor,
  input: {
    key: string;
    userId: string;
    kind: LifecycleEmailKind;
    payload?: Omit<LifecycleEmailPayload, "name">;
    readyWhen?: "immediate" | "verified" | "deleted";
    afterKey?: string;
  },
) => {
  const [owner] = await database
    .select({ email: user.email, name: user.name, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1);
  if (!owner || (!owner.emailVerified && input.readyWhen !== "verified")) return;
  try {
    await database
      .insert(emailOutbox)
      .values({
        id: crypto.randomUUID(),
        deduplicationKey: input.key,
        userId: input.userId,
        recipient: owner.email,
        kind: input.kind,
        payload: { ...input.payload, name: owner.name },
        readyWhen: input.readyWhen ?? "immediate",
        afterKey: input.afterKey,
      })
      .onConflictDoNothing({ target: emailOutbox.deduplicationKey });
  } catch {
    // Do not expose SQL parameters containing recipient or message snapshots to request logs.
    throw new Error("Unable to record lifecycle email");
  }
};

export const claimLifecycleEmail = (database: Database, workerId: string) =>
  database.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(emailOutbox)
      .where(sql`
    ((${emailOutbox.status}='queued' and ${emailOutbox.availableAt}<=now()) or (${emailOutbox.status}='processing' and ${emailOutbox.leasedUntil}<now()))
    and (${emailOutbox.readyWhen}='immediate'
      or (${emailOutbox.readyWhen}='verified' and exists(select 1 from "user" u where u.id=${emailOutbox.userId} and u.email_verified=true))
      or (${emailOutbox.readyWhen}='deleted' and not exists(select 1 from "user" u where u.id=${emailOutbox.userId})))
    and (${emailOutbox.readyWhen}='deleted' or exists(select 1 from "user" u where u.id=${emailOutbox.userId}))
    and (${emailOutbox.afterKey} is null or not exists(select 1 from email_outbox predecessor where predecessor.deduplication_key=${emailOutbox.afterKey} and predecessor.status in ('queued','processing')))
  `)
      .orderBy(emailOutbox.createdAt, emailOutbox.id)
      .limit(1)
      .for("update", { skipLocked: true });
    if (!job) return null;
    if (
      job.attempts >= 6 ||
      (job.attempts > 0 && Date.now() - job.createdAt.getTime() >= 23 * 60 * 60_000)
    ) {
      await tx
        .update(emailOutbox)
        .set({ status: "requires_review", leaseOwner: null, leasedUntil: null })
        .where(eq(emailOutbox.id, job.id));
      return null;
    }
    let recipient = job.recipient;
    let payload = job.payload;
    if (job.kind === "welcome" && job.attempts === 0 && job.userId) {
      const [owner] = await tx.select().from(user).where(eq(user.id, job.userId)).limit(1);
      if (owner) {
        recipient = owner.email;
        payload = { ...payload, name: owner.name };
      }
    }
    const [claimed] = await tx
      .update(emailOutbox)
      .set({
        recipient,
        payload,
        status: "processing",
        leaseOwner: workerId,
        leasedUntil: new Date(Date.now() + 120_000),
        attempts: job.attempts + 1,
      })
      .where(and(eq(emailOutbox.id, job.id), eq(emailOutbox.attempts, job.attempts)))
      .returning();
    return claimed ?? null;
  });
