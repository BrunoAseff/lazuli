import assert from "node:assert/strict";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import sharp from "sharp";
import { and, eq, sql } from "drizzle-orm";
import { createDatabase, type Database } from "../database/client.ts";
import { serverEnv } from "../config.ts";
import {
  user,
  project,
  projectItem,
  document,
  flashcardCollection,
  flashcard,
  quizCollection,
  quizQuestion,
  userFavorite,
  asset,
  userStorage,
  emailOutbox,
  accountExport,
} from "../database/schema/index.ts";
import { setFavorite } from "../favorites/favorite-queries.ts";
import { searchOwnedContent } from "../search/global-search-routes.ts";
import { listProjects, updateProject } from "../projects/project-queries.ts";
import { createProjectCoverRoutes } from "../projects/project-cover-routes.ts";
import { createProjectRoutes } from "../projects/project-routes.ts";
import type { AnalyticsService } from "../analytics/analytics-service.ts";
import type { Auth } from "../auth/auth.ts";
import type { ObjectStorage } from "../storage/object-storage.ts";
import { enqueueLifecycleEmail, claimLifecycleEmail } from "../email/email-outbox.ts";
import { createLifecycleEmailWorker } from "../email/email-worker.ts";
import type { EmailMessage } from "../email/email-transport.ts";
import { createAccountExport } from "../account-settings/account-settings-queries.ts";
import { createAccountExportWorker } from "../account-settings/account-export-worker.ts";
import { getAccountUsage } from "../account-settings/account-usage.ts";

const connection = new URL(serverEnv.DATABASE_URL);
assert.ok(
  ["localhost", "127.0.0.1", "::1"].includes(connection.hostname),
  "This smoke test only runs against a local database",
);
const database = createDatabase(serverEnv.DATABASE_URL);
const marker = `extras${crypto.randomUUID().replaceAll("-", "")}`;
const first = crypto.randomUUID();
const second = crypto.randomUUID();
const projectId = crypto.randomUUID();
const documentId = crypto.randomUUID();
const folderId = crypto.randomUUID();
const fcId = crypto.randomUUID();
const cardId = crypto.randomUUID();
const quizId = crypto.randomUUID();
const questionId = crypto.randomUUID();
const recipient = `${marker}@example.test`;
const rollback = new Error("ROLLBACK_SMOKE_FIXTURES");
const content = (text: string) => [
  {
    id: crypto.randomUUID(),
    type: "paragraph",
    props: {},
    content: [{ type: "text", text, styles: {} }],
    children: [],
  },
];
const fakeObjects = new Map<string, Buffer>();
const fakeStorage = {
  put: async (key: string, bytes: Uint8Array) => {
    fakeObjects.set(key, Buffer.from(bytes));
  },
  get: async (key: string) => {
    const bytes = fakeObjects.get(key);
    assert.ok(bytes, "The export can only read the test's fake object storage");
    return { ContentLength: bytes.length, Body: { transformToByteArray: async () => bytes } };
  },
} as unknown as ObjectStorage;

try {
  await database.db
    .transaction(async (tx) => {
      // A Drizzle transaction supports the query and nested-transaction methods these services use.
      // All data and delivery records created by this script remain inside this outer rollback.
      const db = tx as unknown as Database;
      await tx.insert(user).values([
        {
          id: first,
          name: "Teste Extras",
          email: recipient,
          emailVerified: true,
          createdAt: new Date("2025-01-01"),
        },
        {
          id: second,
          name: "Outra conta",
          email: `other-${recipient}`,
          emailVerified: true,
          createdAt: new Date("2025-01-01"),
        },
      ]);
      await tx
        .insert(project)
        .values({ id: projectId, userId: first, title: `Projeto ${marker}`, coverKey: "library" });
      await tx.insert(projectItem).values([
        {
          id: documentId,
          projectId,
          type: "document",
          title: "Documento com acentos",
          position: 0,
        },
        { id: folderId, projectId, type: "folder", title: "Pasta", position: 1 },
      ]);
      await tx.insert(document).values({
        id: documentId,
        content: content(`Coordenação de tarefas ${marker} segredopessoal`),
      });
      await tx
        .insert(flashcardCollection)
        .values({ id: fcId, userId: first, title: `Coleção ${marker}` });
      await tx.insert(flashcard).values({
        id: cardId,
        collectionId: fcId,
        question: content("Pergunta"),
        answer: content(`Resposta de coordenação ${marker}`),
      });
      await tx
        .insert(quizCollection)
        .values({ id: quizId, userId: first, title: `Quiz ${marker}` });
      await tx.insert(quizQuestion).values({
        id: questionId,
        collectionId: quizId,
        content: content(`Questão de coordenação ${marker}`),
        position: 0,
      });

      assert.equal(await setFavorite(db, second, { kind: "project", id: projectId }, true), false);
      assert.equal(await setFavorite(db, first, { kind: "document", id: folderId }, true), false);
      assert.equal(await setFavorite(db, first, { kind: "project", id: projectId }, true), true);
      await setFavorite(db, first, { kind: "project", id: projectId }, true);
      assert.equal(
        (await tx.select().from(userFavorite).where(eq(userFavorite.userId, first))).length,
        1,
      );
      const filtered = await listProjects(db, first, {
        query: "",
        page: 1,
        pageSize: 12,
        favorites: "only",
      });
      assert.equal(filtered.pagination.totalItems, 1);
      assert.equal(filtered.items[0]?.id, projectId);

      const usage = await getAccountUsage(db, first);
      assert.equal(usage.library.projects, 1);
      assert.equal(usage.library.documents, 1);
      assert.equal(usage.library.flashcards, 1);
      assert.equal(usage.library.questions, 1);
      const results = await searchOwnedContent(db, first, {
        query: "coordenacao",
        favorites: false,
        page: 1,
      });
      assert.ok(results.items.some((item) => item.id === documentId));
      assert.ok(results.items.some((item) => item.id === cardId));
      assert.ok(results.items.some((item) => item.id === questionId));
      assert.ok(results.items.every((item) => !/StopSel|StartSel|<\/?b>/i.test(item.snippet)));
      assert.ok(results.items.some((item) => item.snippet.includes("coordenação")));
      const denied = await searchOwnedContent(db, second, {
        query: marker,
        favorites: false,
        page: 1,
      });
      assert.equal(denied.items.length, 0);
      await tx
        .update(flashcardCollection)
        .set({ archivedAt: new Date() })
        .where(eq(flashcardCollection.id, fcId));
      assert.ok(
        !(
          await searchOwnedContent(db, first, { query: "coordenacao", favorites: false, page: 1 })
        ).items.some((item) => item.id === cardId),
      );
      await tx
        .update(flashcardCollection)
        .set({ archivedAt: null })
        .where(eq(flashcardCollection.id, fcId));

      const app = Fastify({ logger: false });
      await app.register(multipart);
      const auth = {
        api: { getSession: async () => ({ user: { id: first }, session: { id: "fixture" } }) },
      } as unknown as Auth;
      await app.register(
        createProjectCoverRoutes({
          auth,
          database: db,
          storage: fakeStorage,
          websiteUrl: "http://localhost:3000",
          enforceCommercialLimits: true,
        }),
      );
      await app.register(
        createProjectRoutes({
          auth,
          database: db,
          websiteUrl: "http://localhost:3000",
          analytics: {} as AnalyticsService,
        }),
      );
      const foreignProjectId = crypto.randomUUID();
      const deletedProjectId = crypto.randomUUID();
      await tx.insert(project).values([
        { id: foreignProjectId, userId: second, title: "Outra conta" },
        { id: deletedProjectId, userId: first, title: "Temporário para remoção" },
      ]);
      await tx.delete(project).where(eq(project.id, deletedProjectId));
      const recent = await app.inject({
        method: "POST",
        url: "/api/projects/recent",
        headers: { origin: "http://localhost:3000" },
        payload: { ids: [projectId, foreignProjectId, deletedProjectId, crypto.randomUUID()] },
      });
      assert.equal(recent.statusCode, 200, recent.body);
      assert.deepEqual(
        recent.json().items.map((item: { id: string }) => item.id),
        [projectId],
      );
      const image = await sharp({
        create: { width: 640, height: 480, channels: 3, background: "#007bb8" },
      })
        .png()
        .toBuffer();
      const upload = async (
        uploadId: string,
        expectedAssetId: string,
        expectedCoverKey: string,
      ) => {
        const data = new FormData();
        for (const [key, value] of Object.entries({
          uploadId,
          expectedAssetId,
          expectedCoverKey,
          x: "50",
          y: "50",
          zoom: "1",
        }))
          data.set(key, value);
        data.set("file", new Blob([new Uint8Array(image)], { type: "image/png" }), "test.png");
        const request = new Request("http://localhost", { method: "POST", body: data });
        return app.inject({
          method: "POST",
          url: `/api/projects/${projectId}/cover`,
          headers: {
            "content-type": request.headers.get("content-type")!,
            origin: "http://localhost:3000",
          },
          payload: Buffer.from(await request.arrayBuffer()),
        });
      };
      try {
        const operationId = crypto.randomUUID();
        const uploaded = await upload(operationId, "", "library");
        assert.equal(uploaded.statusCode, 200, uploaded.body);
        assert.equal(uploaded.json().coverAssetId, operationId);
        assert.equal((await tx.select().from(asset).where(eq(asset.userId, first))).length, 2);
        const replay = await upload(operationId, "", "library");
        assert.equal(replay.statusCode, 200, replay.body);
        assert.equal((await tx.select().from(asset).where(eq(asset.userId, first))).length, 2);
        const conflict = await upload(crypto.randomUUID(), "", "library");
        assert.equal(conflict.statusCode, 409);
        const coverBytes = (await tx.select().from(asset).where(eq(asset.userId, first))).reduce(
          (sum, item) => sum + item.byteSize,
          0,
        );
        const limit = usage.commercial.storage.limitBytes;
        await tx.update(userStorage).set({ usedBytes: limit }).where(eq(userStorage.userId, first));
        const replacementId = crypto.randomUUID();
        const replaced = await upload(replacementId, operationId, "");
        assert.equal(replaced.statusCode, 200, replaced.body);
        assert.equal(
          (await tx.select().from(userStorage).where(eq(userStorage.userId, first)))[0]?.usedBytes,
          limit,
        );
        await tx
          .update(userStorage)
          .set({ usedBytes: limit + 1 })
          .where(eq(userStorage.userId, first));
        const blocked = await upload(crypto.randomUUID(), replacementId, "");
        assert.equal(blocked.statusCode, 409, blocked.body);
        assert.equal(blocked.json().code, "PLAN_STORAGE_LIMIT_REACHED");
        assert.equal(
          (await tx.select().from(project).where(eq(project.id, projectId)))[0]?.coverAssetId,
          replacementId,
        );
        assert.equal((await tx.select().from(asset).where(eq(asset.userId, first))).length, 2);
        await tx
          .update(userStorage)
          .set({ usedBytes: coverBytes })
          .where(eq(userStorage.userId, first));
        await assert.rejects(
          updateProject(db, first, projectId, {
            coverKey: "library",
            expectedCover: { assetId: operationId, key: null },
          }),
          /COVER_CHANGED/,
        );
        await updateProject(db, first, projectId, {
          coverKey: "library",
          expectedCover: { assetId: replacementId, key: null },
        });
        assert.equal((await tx.select().from(asset).where(eq(asset.userId, first))).length, 0);
        assert.equal(
          (await tx.select().from(userStorage).where(eq(userStorage.userId, first)))[0]?.usedBytes,
          0,
        );
      } finally {
        await app.close();
      }

      const quiet = Fastify({ logger: false });
      const deliveries: { key: string; message: EmailMessage }[] = [];
      let rejectNext = false;
      const worker = createLifecycleEmailWorker(
        db,
        fakeStorage,
        serverEnv,
        quiet.log,
        async ({ to, message, idempotencyKey }) => {
          assert.equal(to, recipient, "Smoke tests must never deliver another account's message");
          deliveries.push({ key: idempotencyKey, message });
          if (rejectNext) {
            rejectNext = false;
            throw new Error("Simulated delivery failure");
          }
          return `fake-provider-${deliveries.length}`;
        },
      );
      await tx.update(user).set({ emailVerified: false }).where(eq(user.id, second));
      const welcomeKey = `${marker}/welcome`;
      await enqueueLifecycleEmail(db, {
        key: welcomeKey,
        userId: second,
        kind: "welcome",
        readyWhen: "verified",
      });
      assert.equal(await claimLifecycleEmail(db, "smoke-verified"), null);
      await tx.update(user).set({ emailVerified: true }).where(eq(user.id, second));
      const welcome = await claimLifecycleEmail(db, "smoke-verified");
      assert.equal(welcome?.userId, second);
      await tx
        .update(emailOutbox)
        .set({ status: "sent", recipient: null, payload: {}, leaseOwner: null, leasedUntil: null })
        .where(eq(emailOutbox.deduplicationKey, welcomeKey));
      const deletedId = crypto.randomUUID();
      await tx.insert(user).values({
        id: deletedId,
        name: "Excluir fixture",
        email: `deleted-${recipient}`,
        emailVerified: true,
        createdAt: new Date("2025-01-01"),
      });
      const deletionKey = `${marker}/deletion`;
      await enqueueLifecycleEmail(db, {
        key: deletionKey,
        userId: deletedId,
        kind: "account_deleted",
        readyWhen: "deleted",
      });
      assert.equal(await claimLifecycleEmail(db, "smoke-deleted"), null);
      await tx.delete(user).where(eq(user.id, deletedId));
      const deletion = await claimLifecycleEmail(db, "smoke-deleted");
      assert.equal(deletion?.userId, deletedId);
      await tx
        .update(emailOutbox)
        .set({ status: "sent", recipient: null, payload: {}, leaseOwner: null, leasedUntil: null })
        .where(eq(emailOutbox.deduplicationKey, deletionKey));
      const eventKey = `${marker}/plan`;
      await enqueueLifecycleEmail(db, {
        key: eventKey,
        userId: first,
        kind: "plan_changed",
        payload: { plan: "Essencial" },
      });
      await enqueueLifecycleEmail(db, {
        key: eventKey,
        userId: first,
        kind: "plan_changed",
        payload: { plan: "Essencial" },
      });
      assert.equal(
        (await tx.select().from(emailOutbox).where(eq(emailOutbox.deduplicationKey, eventKey)))
          .length,
        1,
      );
      await worker.run();
      assert.equal(deliveries.length, 1);
      assert.equal(
        (await tx.select().from(emailOutbox).where(eq(emailOutbox.deduplicationKey, eventKey)))[0]
          ?.status,
        "sent",
      );

      const exportId = await createAccountExport(db, first, ["account", "projects"]);
      assert.ok(exportId);
      await createAccountExportWorker(db, fakeStorage, serverEnv, quiet.log).run();
      const [exported] = await tx
        .select()
        .from(accountExport)
        .where(eq(accountExport.id, exportId));
      assert.equal(exported?.status, "ready");
      await worker.run();
      assert.equal(deliveries.length, 2);
      assert.ok(deliveries[1]?.message.subject.includes("pedido"));
      await worker.run();
      assert.equal(deliveries.length, 3);
      assert.ok(
        deliveries[2]?.message.attachments?.[0]?.content.subarray(0, 2).equals(Buffer.from("PK")),
      );
      assert.equal(
        (await tx.select().from(accountExport).where(eq(accountExport.id, exportId))).length,
        0,
      );

      const retryKey = `${marker}/retry`;
      await enqueueLifecycleEmail(db, {
        key: retryKey,
        userId: first,
        kind: "cancellation_reversed",
      });
      rejectNext = true;
      await worker.run();
      const attempted = deliveries.at(-1)!;
      await tx
        .update(user)
        .set({ name: "Nome alterado depois da tentativa" })
        .where(eq(user.id, first));
      await tx
        .update(emailOutbox)
        .set({ availableAt: new Date(0) })
        .where(eq(emailOutbox.deduplicationKey, retryKey));
      await worker.run();
      assert.equal(deliveries.at(-1)?.key, attempted.key);
      assert.equal(deliveries.at(-1)?.message.html, attempted.message.html);
      await worker.stop();
      await quiet.close();

      const benchmarkIds = Array.from({ length: 1000 }, () => crypto.randomUUID());
      await tx.insert(projectItem).values(
        benchmarkIds.map((id, index) => ({
          id,
          projectId,
          type: "document" as const,
          title: `Leitura ${index}`,
          position: index + 2,
        })),
      );
      await tx.insert(document).values(
        benchmarkIds.map((id) => ({
          id,
          content: content(
            `Coordenação ${"Material para estudar relações entre tarefas. ".repeat(30)}`,
          ),
        })),
      );
      const timings: number[] = [];
      for (let index = 0; index < 20; index++) {
        const start = performance.now();
        await searchOwnedContent(db, first, { query: "coordenacao", favorites: false, page: 1 });
        timings.push(performance.now() - start);
      }
      timings.sort((a, b) => a - b);
      console.info(
        JSON.stringify({
          checks:
            "ownership, favorites, search, cover upload/replay/conflict/cleanup, email deduplication/retry, export attachment",
          benchmarkDocuments: 1000,
          searchP95Ms: Math.round(timings[18]!),
          realEmailsSent: 0,
          fixturePolicy: "rollback",
        }),
      );
      throw rollback;
    })
    .catch((error: unknown) => {
      if (error !== rollback) throw error;
    });
  assert.equal(
    (
      await database.db
        .select()
        .from(user)
        .where(and(eq(user.id, first), sql`true`))
    ).length,
    0,
  );
} finally {
  await database.client.end({ timeout: 5 });
}
