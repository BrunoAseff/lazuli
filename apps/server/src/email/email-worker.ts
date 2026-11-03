import { and, eq, sql } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import type { Database } from "../database/client.ts";
import type { ServerEnv } from "../config.ts";
import { accountExport, emailOutbox } from "../database/schema/index.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";
import { enqueueObjectDeletions } from "../storage/storage-cleanup.ts";
import { claimLifecycleEmail } from "./email-outbox.ts";
import { createEmailTransport, type EmailMessage } from "./email-transport.ts";
import { createLifecycleEmail, lifecycleEmailPayloadSchema } from "./lifecycle-email.ts";

export const createLifecycleEmailWorker = (
  database: Database,
  storage: ObjectStorage,
  env: ServerEnv,
  logger: FastifyBaseLogger,
  send = createEmailTransport(env),
) => {
  const workerId = `email:${crypto.randomUUID()}`;
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  let operation: Promise<void> | undefined;
  let lastCleanup = 0;

  const run = async () => {
    try {
      if (Date.now() - lastCleanup > 60_000) {
        lastCleanup = Date.now();
        // Recover a signup interrupted after the user was committed but before its hook queued mail.
        // The deployment cutoff deliberately excludes accounts that already existed at rollout.
        await database.execute(sql`insert into email_outbox (id, deduplication_key, user_id, recipient, kind, payload, ready_when)
          select gen_random_uuid()::text, 'welcome/' || u.id, u.id, u.email, 'welcome', jsonb_build_object('name',u.name), 'verified'
          from "user" u where u.created_at >= (select activated_at from email_rollout where key='lifecycle-v1')
          and not exists (select 1 from email_outbox e where e.deduplication_key='welcome/' || u.id)
          order by u.created_at, u.id limit 100 on conflict (deduplication_key) do nothing`);
        await database.execute(sql`update email_outbox set status='failed', recipient=null, payload='{}'::jsonb, rendered=null, user_id=null
          where status='queued' and ((kind<>'account_deleted' and not exists(select 1 from "user" u where u.id=email_outbox.user_id))
            or (ready_when in ('verified','deleted') and created_at<now()-interval '7 days'))`);
        const expired = await database
          .select()
          .from(emailOutbox)
          .where(
            sql`${emailOutbox.status} in ('failed','requires_review') and ${emailOutbox.createdAt}<now()-interval '7 days' and ${emailOutbox.recipient} is not null`,
          )
          .limit(100);
        for (const item of expired)
          await database.transaction(async (tx) => {
            const payload = lifecycleEmailPayloadSchema.safeParse(item.payload);
            if (payload.success && payload.data.attachmentKey) {
              await enqueueObjectDeletions(tx, [payload.data.attachmentKey]);
              if (payload.data.exportId)
                await tx.delete(accountExport).where(eq(accountExport.id, payload.data.exportId));
            }
            await tx
              .update(emailOutbox)
              .set({ status: "failed", recipient: null, payload: {}, rendered: null, userId: null })
              .where(eq(emailOutbox.id, item.id));
          });
      }
      const job = await claimLifecycleEmail(database, workerId);
      if (!job) return;
      const owned = and(
        eq(emailOutbox.id, job.id),
        eq(emailOutbox.leaseOwner, workerId),
        eq(emailOutbox.status, "processing"),
      );
      const heartbeat = setInterval(() => {
        void database
          .update(emailOutbox)
          .set({ leasedUntil: new Date(Date.now() + 120_000) })
          .where(owned)
          .catch(() => logger.error({ emailId: job.id }, "email lease heartbeat failed"));
      }, 30_000);
      try {
        const payload = lifecycleEmailPayloadSchema.parse(job.payload);
        if (!job.recipient) throw new Error("Email recipient is missing");
        const rendered = job.rendered ?? createLifecycleEmail(job.kind, payload, env.WEBSITE_URL);
        if (!job.rendered) {
          const saved = await database
            .update(emailOutbox)
            .set({ rendered })
            .where(owned)
            .returning({ id: emailOutbox.id });
          if (!saved.length) return;
        }
        const message: EmailMessage = { ...rendered };
        if (job.kind === "export_ready") {
          if (!payload.attachmentKey || !payload.filename || !payload.exportId)
            throw new Error("Export attachment metadata missing");
          const object = await storage.get(payload.attachmentKey);
          if (!object.Body || (object.ContentLength ?? 0) > 28_000_000)
            throw new Error("Invalid export attachment");
          const bytes = await object.Body.transformToByteArray();
          if (bytes.byteLength > 28_000_000)
            throw new Error("Export attachment exceeds email limit");
          message.attachments = [
            {
              content: Buffer.from(bytes),
              contentType: "application/zip",
              filename: payload.filename,
            },
          ];
        }
        const providerId = await send({
          to: job.recipient,
          message,
          idempotencyKey: `lifecycle/v1/${job.id}`,
        });
        await database.transaction(async (tx) => {
          const saved = await tx
            .update(emailOutbox)
            .set({
              status: "sent",
              sentAt: new Date(),
              providerId,
              leaseOwner: null,
              leasedUntil: null,
              recipient: null,
              payload: {},
              rendered: null,
              userId: null,
            })
            .where(owned)
            .returning({ id: emailOutbox.id });
          if (!saved.length) return;
          if (job.kind === "export_ready" && payload.attachmentKey && payload.exportId) {
            await enqueueObjectDeletions(tx, [payload.attachmentKey]);
            await tx.delete(accountExport).where(eq(accountExport.id, payload.exportId));
          }
        });
        logger.info({ emailId: job.id, kind: job.kind }, "lifecycle email accepted");
      } catch {
        const requiresReview =
          job.attempts >= 6 || Date.now() - job.createdAt.getTime() >= 23 * 60 * 60_000;
        await database
          .update(emailOutbox)
          .set({
            status: requiresReview ? "requires_review" : "queued",
            availableAt: new Date(Date.now() + Math.min(60_000, 2 ** job.attempts * 1_000)),
            leaseOwner: null,
            leasedUntil: null,
          })
          .where(owned);
        logger.error(
          { emailId: job.id, kind: job.kind, requiresReview },
          "lifecycle email delivery failed",
        );
      } finally {
        clearInterval(heartbeat);
      }
    } catch {
      logger.error("lifecycle email worker iteration failed");
    }
  };
  const launch = () => {
    if (stopped || operation) return;
    operation = run().finally(() => {
      operation = undefined;
      if (!stopped) timer = setTimeout(launch, 2_000);
    });
  };
  return {
    run,
    start: launch,
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      await operation;
    },
  };
};
