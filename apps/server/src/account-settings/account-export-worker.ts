import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { AccountExportCategory } from "@lazuli/shared";
import { type Archiver, ZipArchive } from "archiver";
import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";

import type { ServerEnv } from "../config.ts";
import type { Database } from "../database/client.ts";
import {
  accountExport,
  asset,
  billingSubscription,
  document,
  flashcard,
  flashcardCollection,
  flashcardPracticeItem,
  flashcardPracticeSession,
  flashcardReview,
  project,
  projectItem,
  quizAttempt,
  quizAttemptItem,
  quizCollection,
  quizOption,
  quizQuestion,
  studyMaterialReference,
  user,
  userAnalyticsPreference,
  userStudyPreference,
  userInterfacePreference,
  userFavorite,
  legalAcceptance,
  analyticsConsentEvent,
} from "../database/schema/index.ts";
import { enqueueLifecycleEmail } from "../email/email-outbox.ts";
import { enqueueObjectDeletions } from "../storage/storage-cleanup.ts";
import { storageObjectDeletion } from "../database/schema/index.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";

const POLL_INTERVAL_MS = 2_000;
const LEASE_MS = 2 * 60_000;
const LEASE_HEARTBEAT_MS = LEASE_MS / 2;
const MAX_EMAIL_ATTACHMENT_BYTES = 28_000_000;

type ClaimedExport = typeof accountExport.$inferSelect;

const safeFilename = (value: string) =>
  value
    .normalize("NFKD")
    .replaceAll(/[^a-zA-Z0-9._-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 100) || "arquivo";

const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

const scalarText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return value.toString();
  if (typeof value === "object")
    return Object.entries(value)
      .map(([key, nested]) => `${key}: ${scalarText(nested)}`)
      .join("; ");
  return "";
};

const flattenCsvRow = (
  value: unknown,
  prefix = "",
  row: Record<string, string> = {},
): Record<string, string> => {
  if (Array.isArray(value)) {
    row[prefix || "valor"] = value.map(scalarText).join("; ");
    return row;
  }
  if (value instanceof Date || value === null || typeof value !== "object") {
    row[prefix || "valor"] = scalarText(value);
    return row;
  }
  for (const [key, nested] of Object.entries(value))
    flattenCsvRow(nested, prefix ? `${prefix}.${key}` : key, row);
  return row;
};

export const createCsv = (value: unknown) => {
  const values = Array.isArray(value) ? value : [value];
  const rows = values.map((item) => flattenCsvRow(item));
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [
    columns.map(csvCell).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column] ?? "")).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
};

const csvNames: Record<string, string> = {
  account: "conta",
  analyticsPreference: "preferencia-metricas",
  legalAcceptances: "aceites-termos",
  analyticsConsentEvents: "historico-preferencias-metricas",
  documents: "documentos",
  flashcardCollections: "colecoes-flashcards",
  flashcardPracticeItems: "itens-praticas-flashcards",
  flashcardPracticeSessions: "praticas-flashcards",
  flashcardReviews: "revisoes-flashcards",
  flashcards: "flashcards",
  projectItems: "itens-projetos",
  projects: "projetos",
  quizAttemptItems: "respostas-quizzes",
  quizAttempts: "tentativas-quizzes",
  quizCollections: "colecoes-quizzes",
  quizOptions: "opcoes-quizzes",
  quizQuestions: "questoes-quizzes",
  references: "referencias",
  studyPreferences: "preferencias-estudo",
  subscription: "assinatura",
  interfacePreference: "preferencias-aparencia",
  favorites: "favoritos",
};

const claimNextExport = (database: Database, workerId: string) =>
  database.transaction(async (tx) => {
    const now = new Date();
    const [next] = await tx
      .select()
      .from(accountExport)
      .where(
        or(
          and(eq(accountExport.status, "queued"), lt(accountExport.availableAt, now)),
          and(eq(accountExport.status, "processing"), lt(accountExport.leasedUntil, now)),
        ),
      )
      .orderBy(asc(accountExport.availableAt), asc(accountExport.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!next) return null;
    if (next.attempts >= next.maxAttempts) {
      await tx
        .update(accountExport)
        .set({
          errorCode: "EXPORT_PROCESSING_FAILED",
          leaseOwner: null,
          leasedUntil: null,
          status: "failed",
          updatedAt: now,
        })
        .where(eq(accountExport.id, next.id));
      await enqueueLifecycleEmail(tx, {
        key: `export-failed/${next.id}`,
        userId: next.userId,
        kind: "export_failed",
        afterKey: `export-requested/${next.id}`,
      });
      return null;
    }
    const [claimed] = await tx
      .update(accountExport)
      .set({
        attempts: sql`${accountExport.attempts} + 1`,
        errorCode: null,
        leaseOwner: workerId,
        leasedUntil: new Date(now.getTime() + LEASE_MS),
        status: "processing",
        updatedAt: now,
      })
      .where(eq(accountExport.id, next.id))
      .returning();
    return claimed ?? null;
  });

const failExport = async (database: Database, job: ClaimedExport, workerId: string) => {
  const terminal = job.attempts >= job.maxAttempts;
  await database.transaction(async (tx) => {
    const updated = await tx
      .update(accountExport)
      .set({
        availableAt: new Date(Date.now() + Math.min(60_000, 2 ** job.attempts * 1_000)),
        errorCode: terminal ? "EXPORT_PROCESSING_FAILED" : null,
        leaseOwner: null,
        leasedUntil: null,
        status: terminal ? "failed" : "queued",
        updatedAt: new Date(),
      })
      .where(and(eq(accountExport.id, job.id), eq(accountExport.leaseOwner, workerId)))
      .returning({ id: accountExport.id });
    if (terminal && updated.length)
      await enqueueLifecycleEmail(tx, {
        key: `export-failed/${job.id}`,
        userId: job.userId,
        kind: "export_failed",
        afterKey: `export-requested/${job.id}`,
      });
  });
};

const selectOwnedData = async (
  database: Database,
  userId: string,
  categories: AccountExportCategory[],
) => {
  const selected = new Set(categories);
  const result: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
  };

  if (selected.has("account")) {
    const [owners, study, analytics, subscriptions] = await Promise.all([
      database
        .select({
          createdAt: user.createdAt,
          email: user.email,
          emailVerified: user.emailVerified,
          id: user.id,
          name: user.name,
          updatedAt: user.updatedAt,
        })
        .from(user)
        .where(eq(user.id, userId)),
      database.select().from(userStudyPreference).where(eq(userStudyPreference.userId, userId)),
      database
        .select()
        .from(userAnalyticsPreference)
        .where(eq(userAnalyticsPreference.userId, userId)),
      database
        .select({
          accessUntil: billingSubscription.accessUntil,
          cancelAtPeriodEnd: billingSubscription.cancelAtPeriodEnd,
          currentPeriodEnd: billingSubscription.currentPeriodEnd,
          plan: billingSubscription.plan,
          status: billingSubscription.status,
        })
        .from(billingSubscription)
        .where(eq(billingSubscription.userId, userId)),
    ]);
    result.account = owners[0] ?? null;
    result.studyPreferences = study[0] ?? { desiredRetention: 90 };
    result.analyticsPreference = analytics[0] ?? null;
    result.subscription = subscriptions[0] ?? null;
    const [appearance, favorites] = await Promise.all([
      database
        .select({ theme: userInterfacePreference.theme })
        .from(userInterfacePreference)
        .where(eq(userInterfacePreference.userId, userId)),
      database.select().from(userFavorite).where(eq(userFavorite.userId, userId)),
    ]);
    result.interfacePreference = appearance[0] ?? { theme: "system" };
    result.favorites = favorites;
    const [acceptances, consentEvents] = await Promise.all([
      database.select().from(legalAcceptance).where(eq(legalAcceptance.userId, userId)),
      database.select().from(analyticsConsentEvent).where(eq(analyticsConsentEvent.userId, userId)),
    ]);
    result.legalAcceptances = acceptances;
    result.analyticsConsentEvents = consentEvents;
  }

  const projects = selected.has("projects")
    ? await database.select().from(project).where(eq(project.userId, userId))
    : [];
  const projectIds = projects.map(({ id }) => id);
  if (selected.has("projects")) {
    const items = projectIds.length
      ? await database.select().from(projectItem).where(inArray(projectItem.projectId, projectIds))
      : [];
    const documentIds = items.filter(({ type }) => type === "document").map(({ id }) => id);
    result.projects = projects.map(({ coverKey: _coverKey, ...item }) => item);
    result.projectItems = items;
    result.documents = documentIds.length
      ? await database.select().from(document).where(inArray(document.id, documentIds))
      : [];
  }

  if (selected.has("flashcards")) {
    const collections = await database
      .select()
      .from(flashcardCollection)
      .where(eq(flashcardCollection.userId, userId));
    const collectionIds = collections.map(({ id }) => id);
    const sessions = await database
      .select()
      .from(flashcardPracticeSession)
      .where(eq(flashcardPracticeSession.userId, userId));
    const sessionIds = sessions.map(({ id }) => id);
    result.flashcardCollections = collections;
    result.flashcards = collectionIds.length
      ? await database
          .select()
          .from(flashcard)
          .where(inArray(flashcard.collectionId, collectionIds))
      : [];
    result.flashcardPracticeSessions = sessions;
    result.flashcardPracticeItems = sessionIds.length
      ? await database
          .select()
          .from(flashcardPracticeItem)
          .where(inArray(flashcardPracticeItem.sessionId, sessionIds))
      : [];
    result.flashcardReviews = sessionIds.length
      ? await database
          .select()
          .from(flashcardReview)
          .where(inArray(flashcardReview.sessionId, sessionIds))
      : [];
  }

  if (selected.has("quizzes")) {
    const collections = await database
      .select()
      .from(quizCollection)
      .where(eq(quizCollection.userId, userId));
    const collectionIds = collections.map(({ id }) => id);
    const questions = collectionIds.length
      ? await database
          .select()
          .from(quizQuestion)
          .where(inArray(quizQuestion.collectionId, collectionIds))
      : [];
    const questionIds = questions.map(({ id }) => id);
    const attempts = await database
      .select()
      .from(quizAttempt)
      .where(eq(quizAttempt.userId, userId));
    const attemptIds = attempts.map(({ id }) => id);
    result.quizCollections = collections;
    result.quizQuestions = questions;
    result.quizOptions = questionIds.length
      ? await database.select().from(quizOption).where(inArray(quizOption.questionId, questionIds))
      : [];
    result.quizAttempts = attempts;
    result.quizAttemptItems = attemptIds.length
      ? await database
          .select()
          .from(quizAttemptItem)
          .where(inArray(quizAttemptItem.attemptId, attemptIds))
      : [];
  }

  if (selected.has("references"))
    result.references = await database
      .select()
      .from(studyMaterialReference)
      .where(eq(studyMaterialReference.userId, userId));

  return result;
};

const addPrivateFiles = async (
  archive: Archiver,
  database: Database,
  storage: ObjectStorage,
  userId: string,
  includeProjects: boolean,
) => {
  if (!includeProjects) return;
  const assets = await database
    .select({ id: asset.id, key: asset.objectKey, name: asset.originalName })
    .from(asset)
    .where(eq(asset.userId, userId));
  for (const file of assets) {
    const object = await storage.get(file.key);
    if (object.Body)
      archive.append(object.Body as Readable, {
        name: `files/assets/${file.id}-${safeFilename(file.name)}`,
      });
  }
};

const writeArchive = async (
  database: Database,
  storage: ObjectStorage,
  job: ClaimedExport,
  destination: string,
) => {
  const output = createWriteStream(destination, { flags: "wx", mode: 0o600 });
  const archive = new ZipArchive({ zlib: { level: 6 } });
  let bytes = 0;
  const byteLimit = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > MAX_EMAIL_ATTACHMENT_BYTES) {
        callback(new Error("Account export exceeded the maximum email attachment size"));
        return;
      }
      callback(null, chunk);
    },
  });
  const completed = pipeline(archive, byteLimit, output);
  void completed.catch(() => undefined);
  try {
    const data = await selectOwnedData(database, job.userId, job.categories);
    archive.append(
      [
        "Cópia dos seus dados do Lazúli",
        `Preparada em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
        "",
        "Os dados tabulares estão na pasta dados em arquivos CSV, que podem ser abertos em qualquer planilha.",
        "Os arquivos originais enviados ao Lazúli estão na pasta files.",
        "",
      ].join("\n"),
      { name: "LEIA-ME.txt" },
    );
    for (const [name, value] of Object.entries(data))
      if (name !== "formatVersion" && name !== "exportedAt")
        archive.append(createCsv(value), {
          name: `dados/${csvNames[name] ?? safeFilename(name)}.csv`,
        });
    await addPrivateFiles(
      archive,
      database,
      storage,
      job.userId,
      job.categories.includes("projects"),
    );
    await archive.finalize();
    await completed;
  } catch (error) {
    archive.abort();
    output.destroy();
    await completed.catch(() => undefined);
    throw error;
  }
};

export const createAccountExportWorker = (
  database: Database,
  storage: ObjectStorage,
  env: ServerEnv,
  logger: FastifyBaseLogger,
) => {
  const workerId = `account-export:${process.pid}:${crypto.randomUUID()}`;
  let timer: NodeJS.Timeout | undefined;
  let inFlight: Promise<void> | undefined;
  let stopped = false;

  const run = async () => {
    try {
      const job = await claimNextExport(database, workerId);
      if (!job) return;
      const heartbeat = setInterval(() => {
        void database
          .update(accountExport)
          .set({ leasedUntil: new Date(Date.now() + LEASE_MS), updatedAt: new Date() })
          .where(
            and(
              eq(accountExport.id, job.id),
              eq(accountExport.leaseOwner, workerId),
              eq(accountExport.status, "processing"),
            ),
          )
          .catch((error) =>
            logger.error({ err: error, exportId: job.id }, "account export heartbeat failed"),
          );
      }, LEASE_HEARTBEAT_MS);
      try {
        const directory = await mkdtemp(join(tmpdir(), "lazuli-export-"));
        const destination = join(directory, `${job.id}.zip`);
        try {
          await writeArchive(database, storage, job, destination);
          const file = await stat(destination);
          if (file.size > MAX_EMAIL_ATTACHMENT_BYTES)
            throw new Error("Account export exceeded the maximum email attachment size");
          const [owner] = await database
            .select({ email: user.email, emailVerified: user.emailVerified, name: user.name })
            .from(user)
            .where(eq(user.id, job.userId))
            .limit(1);
          if (!owner?.emailVerified) throw new Error("Account export owner has no verified email");
          const objectKey = `${job.userId}/account-exports/${job.id}/${crypto.randomUUID()}.zip`;
          await enqueueObjectDeletions(database, [objectKey], 24 * 60 * 60_000);
          await storage.put(objectKey, await readFile(destination), "application/zip", file.size);
          await database.transaction(async (tx) => {
            const saved = await tx
              .update(accountExport)
              .set({
                status: "ready",
                objectKey,
                byteSize: file.size,
                readyAt: new Date(),
                leaseOwner: null,
                leasedUntil: null,
                updatedAt: new Date(),
              })
              .where(and(eq(accountExport.id, job.id), eq(accountExport.leaseOwner, workerId)))
              .returning({ id: accountExport.id });
            if (!saved.length) return;
            await tx
              .delete(storageObjectDeletion)
              .where(eq(storageObjectDeletion.objectKey, objectKey));
            await enqueueLifecycleEmail(tx, {
              key: `export-ready/${job.id}`,
              userId: job.userId,
              kind: "export_ready",
              afterKey: `export-requested/${job.id}`,
              payload: {
                exportId: job.id,
                attachmentKey: objectKey,
                filename: `dados-lazuli-${new Date().toISOString().slice(0, 10)}.zip`,
              },
            });
          });
        } catch (error) {
          logger.error({ err: error, exportId: job.id }, "account export processing failed");
          await failExport(database, job, workerId);
        } finally {
          await rm(directory, { force: true, recursive: true });
        }
      } finally {
        clearInterval(heartbeat);
      }
    } catch (error) {
      logger.error({ err: error }, "account export worker iteration failed");
    }
  };

  const launch = () => {
    if (stopped || inFlight) return;
    const operation = run();
    inFlight = operation;
    void operation.finally(() => {
      if (inFlight === operation) inFlight = undefined;
      if (!stopped) timer = setTimeout(launch, POLL_INTERVAL_MS);
    });
  };

  return {
    run,
    start() {
      launch();
    },
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      await inFlight;
    },
  };
};

export type AccountExportWorker = ReturnType<typeof createAccountExportWorker>;
