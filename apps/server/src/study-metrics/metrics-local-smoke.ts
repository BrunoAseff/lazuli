import assert from "node:assert/strict";
import { sql, eq, and } from "drizzle-orm";
import Fastify from "fastify";
import { createDatabase, type Database } from "../database/client.ts";
import { serverEnv } from "../config.ts";
import {
  user,
  flashcardCollection,
  flashcard,
  flashcardPracticeSession,
  flashcardPracticeItem,
  flashcardReview,
  quizCollection,
  quizQuestion,
  quizOption,
  quizAttempt,
  quizAttemptItem,
} from "../database/schema/index.ts";
import {
  getStudyMetrics,
  getStudyRanking,
  getStudyAttempts,
  ownsMetricsCollection,
  getMetricsCollections,
} from "./study-metrics-queries.ts";
import { createStudyMetricsRoutes } from "./study-metrics-routes.ts";
import { createQuizAttempt } from "../quizzes/quiz-attempt-queries.ts";
import { getQuizAttempt } from "../quizzes/quiz-attempt-queries.ts";
import { quizAttemptSchema } from "@lazuli/shared";
import { metricsAggregateQuery } from "./study-metrics-queries.ts";
import type { Auth } from "../auth/auth.ts";

assert.ok(
  ["localhost", "127.0.0.1", "::1"].includes(new URL(serverEnv.DATABASE_URL).hostname),
  "Only a local database is allowed",
);
const connection = createDatabase(serverEnv.DATABASE_URL);
const rollback = new Error("ROLLBACK_METRICS_FIXTURES");
const content = (text: string) => [
  {
    id: "00000000-0000-4000-8000-000000000001",
    type: "paragraph",
    content: [{ type: "text", text, styles: {} }],
  },
];
const owner = crypto.randomUUID(),
  other = crypto.randomUUID(),
  fc = crypto.randomUUID(),
  foreign = crypto.randomUUID(),
  quiz = crypto.randomUUID(),
  question = crypto.randomUUID();
const input = {
  from: "2026-10-20",
  to: "2026-10-22",
  tz: "America/Sao_Paulo",
  compare: "true" as const,
};
try {
  await connection.db
    .transaction(async (tx) => {
      const db = tx as unknown as Database;
      await tx.insert(user).values(
        [owner, other].map((id) => ({
          id,
          name: "Study metrics smoke",
          email: `${id}@example.test`,
          emailVerified: true,
        })),
      );
      await tx.insert(flashcardCollection).values([
        { id: fc, userId: owner, title: "Coleção de teste" },
        { id: foreign, userId: other, title: "Segredo de outra conta" },
      ]);
      const ids = Array.from({ length: 16 }, () => crypto.randomUUID());
      await tx.insert(flashcard).values(
        ids.map((id, i) => ({
          id,
          collectionId: i === 15 ? foreign : fc,
          question: content(`Card ${i}`),
          answer: content("Resposta"),
          srsState: "review" as const,
        })),
      );
      for (let i = 0; i < ids.length; i++)
        for (let day = 0; day < 3; day++) {
          const session = crypto.randomUUID(),
            item = crypto.randomUUID();
          const at = new Date(`2026-10-${20 + day}T15:00:00Z`);
          await tx.insert(flashcardPracticeSession).values({
            id: session,
            userId: i === 15 ? other : owner,
            collectionId: i === 15 ? foreign : fc,
            status: "completed",
            totalCards: 1,
            reviewedCards: 1,
            startedAt: at,
            finishedAt: at,
          });
          await tx
            .insert(flashcardPracticeItem)
            .values({ id: item, sessionId: session, flashcardId: ids[i]!, position: 0 });
          const base = {
            flashcardId: ids[i]!,
            sessionId: session,
            practiceItemId: item,
            reviewedAt: at,
            previousDueAt: at,
            nextDueAt: new Date(at.getTime() + 86400000),
            previousState: "review" as const,
            nextState: "review" as const,
            stability: 2,
            difficulty: 3,
            elapsedDays: 1,
            scheduledDays: 1,
            learningSteps: 0,
            schedulerVersion: "ts-fsrs@5.4.1",
          };
          await tx
            .insert(flashcardReview)
            .values({ id: crypto.randomUUID(), ...base, rating: day === 0 ? "again" : "good" });
          if (i === 0 && day === 0)
            await tx.insert(flashcardReview).values({
              id: crypto.randomUUID(),
              ...base,
              reviewedAt: new Date(at.getTime() + 1000),
              rating: "good",
              stability: 9,
            });
        }
      const report = await getStudyMetrics(db, owner, input, "flashcards");
      assert.equal(report.summary.evaluations, 46);
      assert.equal(report.summary.cards, 15);
      assert.equal(
        report.summary.eligible,
        45,
        "Immediate repetition must not inflate denominator",
      );
      assert.equal(
        report.summary.remembered,
        30,
        "Again then Good on same day stays a failed spaced review",
      );
      assert.equal(report.summary.days, 3);
      assert.equal(report.previous?.evaluations, 0);
      assert.equal(
        report.series.reduce((n, d) => n + d.evaluations, 0),
        46,
      );
      const rankingInput = {
        ...input,
        page: 1,
        includeArchived: "false" as const,
        order: "errors" as const,
      };
      const restoreComparison = new Error("RESTORE_COMPARISON_FIXTURE");
      await tx
        .transaction(async (inner) => {
          const [template] = await inner
            .select()
            .from(flashcardReview)
            .where(eq(flashcardReview.flashcardId, ids[1]!))
            .limit(1);
          assert.ok(template);
          for (const timestamp of [
            "2026-10-19T15:00:00Z",
            "2026-10-19T17:00:00Z",
            "2026-10-22T17:00:00Z",
          ]) {
            const sessionId = crypto.randomUUID(),
              practiceItemId = crypto.randomUUID(),
              at = new Date(timestamp);
            await inner.insert(flashcardPracticeSession).values({
              id: sessionId,
              userId: owner,
              collectionId: fc,
              status: "completed",
              totalCards: 1,
              reviewedCards: 1,
              startedAt: at,
              finishedAt: at,
            });
            await inner
              .insert(flashcardPracticeItem)
              .values({ id: practiceItemId, sessionId, flashcardId: ids[1]!, position: 0 });
            await inner.insert(flashcardReview).values({
              ...template,
              id: crypto.randomUUID(),
              sessionId,
              practiceItemId,
              reviewedAt: at,
              previousDueAt: at,
              nextDueAt: new Date(at.getTime() + 86400000),
            });
          }
          const partial = await getStudyMetrics(
            inner as unknown as Database,
            owner,
            input,
            "flashcards",
            new Date("2026-10-22T16:00:00Z"),
          );
          assert.equal(
            partial.summary.evaluations,
            46,
            "Current period excludes reviews after reference time",
          );
          assert.equal(
            partial.previous?.evaluations,
            1,
            "Prior period excludes later wall-clock activity",
          );
          assert.equal(
            partial.previousSeries?.reduce((sum, p) => sum + p.evaluations, 0),
            1,
          );
          assert.equal(
            partial.series.reduce((sum, p) => sum + p.evaluations, 0),
            46,
          );
          const complete = await getStudyMetrics(
            inner as unknown as Database,
            owner,
            input,
            "flashcards",
            new Date("2026-10-26T16:00:00Z"),
          );
          assert.equal(complete.summary.evaluations, 47);
          assert.equal(complete.previous?.evaluations, 2);
          throw restoreComparison;
        })
        .catch((error: unknown) => {
          if (error !== restoreComparison) throw error;
        });
      const first = await getStudyRanking(db, owner, rankingInput, "flashcards");
      const second = await getStudyRanking(db, owner, { ...rankingInput, page: 2 }, "flashcards");
      const third = await getStudyRanking(db, owner, { ...rankingInput, page: 3 }, "flashcards");
      assert.equal(first.items.length, 5);
      assert.equal(second.items.length, 5);
      assert.equal(first.hasMore, true);
      assert.equal(second.hasMore, true);
      assert.equal(third.hasMore, false);
      assert.equal(
        new Set([...first.items, ...second.items, ...third.items].map((i) => i.id)).size,
        15,
      );
      assert.ok(
        [...first.items, ...second.items].every(
          (i) => i.total === 3 && i.failures === 1 && i.stability === 2,
        ),
      );
      assert.equal(first.emptyReason, null);
      assert.equal(
        (await getStudyRanking(db, owner, { ...rankingInput, page: 99 }, "flashcards")).emptyReason,
        "outOfRange",
      );
      assert.equal(
        (
          await getStudyRanking(
            db,
            owner,
            { ...rankingInput, from: "2026-01-01", to: "2026-01-07" },
            "flashcards",
          )
        ).emptyReason,
        "noPractice",
      );
      assert.equal(
        (
          await getStudyRanking(
            db,
            owner,
            { ...rankingInput, from: "2026-10-20", to: "2026-10-20" },
            "flashcards",
          )
        ).emptyReason,
        "initial",
      );
      // Savepoint tests of the empty-state evidence must not change the main fixture.
      const restore = new Error("RESTORE_EMPTY_STATE_FIXTURE");
      await tx
        .transaction(async (inner) => {
          await inner.execute(
            sql`update flashcard set archived_at=now() where collection_id=${fc}`,
          );
          assert.equal(
            (await getStudyRanking(inner as unknown as Database, owner, rankingInput, "flashcards"))
              .emptyReason,
            "onlyArchived",
          );
          assert.equal(
            (
              await getStudyRanking(
                inner as unknown as Database,
                owner,
                { ...rankingInput, includeArchived: "true" },
                "flashcards",
              )
            ).items.length,
            5,
          );
          await inner.execute(
            sql`update flashcard_review set rating='good' where flashcard_id in (select id from flashcard where collection_id=${fc})`,
          );
          assert.equal(
            (
              await getStudyRanking(
                inner as unknown as Database,
                owner,
                { ...rankingInput, includeArchived: "true" },
                "flashcards",
              )
            ).emptyReason,
            "noDifficulty",
          );
          throw restore;
        })
        .catch((error: unknown) => {
          if (error !== restore) throw error;
        });
      await tx.update(flashcard).set({ archivedAt: new Date() }).where(eq(flashcard.id, ids[0]!));
      assert.equal(
        (await getStudyRanking(db, owner, { ...rankingInput, page: 3 }, "flashcards")).items.length,
        4,
      );
      assert.equal(
        (await getStudyMetrics(db, owner, input, "flashcards")).summary.evaluations,
        46,
        "Archive preserves totals",
      );
      assert.equal(await ownsMetricsCollection(db, owner, "flashcards", foreign), false);
      assert.equal((await getMetricsCollections(db, owner, "flashcards", "", 1)).items.length, 1);
      assert.equal((await getStudyMetrics(db, other, input, "flashcards")).summary.evaluations, 3);
      const noData = await getStudyMetrics(
        db,
        owner,
        { ...input, from: "2026-01-01", to: "2026-01-01", compare: "false" },
        "flashcards",
      );
      assert.equal(noData.hasHistory, true);
      assert.equal(noData.summary.evaluations, 0);
      await tx.insert(quizCollection).values({ id: quiz, userId: owner, title: "Quiz de teste" });
      await tx.insert(quizQuestion).values({
        id: question,
        collectionId: quiz,
        content: content("Questão original"),
        position: 0,
      });
      const options = [
        { id: crypto.randomUUID(), text: "Correta", position: 0 },
        { id: crypto.randomUUID(), text: "Incorreta", position: 1 },
      ];
      await tx
        .insert(quizOption)
        .values(options.map((o, i) => ({ ...o, questionId: question, isCorrect: i === 0 })));
      const fingerprint = sql<string>`lazuli_quiz_fingerprint(${JSON.stringify(content("Questão original"))}::jsonb,${JSON.stringify(options)}::jsonb,${options[0]!.id})`;
      for (let i = 0; i < 4; i++) {
        const attempt = crypto.randomUUID(),
          at = new Date(`2026-10-${20 + (i % 3)}T16:00:00Z`);
        await tx.insert(quizAttempt).values({
          id: attempt,
          userId: owner,
          collectionId: quiz,
          status: i === 3 ? "active" : "completed",
          answeredQuestions: 1,
          correctAnswers: i === 0 ? 1 : 0,
          totalQuestions: 1,
          completedAt: i === 3 ? null : at,
        });
        await tx.insert(quizAttemptItem).values({
          id: crypto.randomUUID(),
          attemptId: attempt,
          questionId: question,
          originalQuestionId: question,
          questionFingerprint: fingerprint,
          position: 0,
          question: content("Questão original"),
          options,
          correctOptionId: options[0]!.id,
          selectedOptionId: options[i === 0 ? 0 : 1]!.id,
          answeredAt: at,
          isCorrect: i === 3 ? null : i === 0,
        });
      }
      const q = await getStudyMetrics(db, owner, input, "quizzes");
      assert.equal(q.summary.attempts, 3);
      assert.equal(q.summary.quizAnswers, 3);
      assert.equal(q.summary.quizCorrect, 1);
      assert.equal((await getStudyAttempts(db, owner, rankingInput)).items.length, 3);
      const qr = await getStudyRanking(db, owner, rankingInput, "quizzes");
      assert.equal(qr.items.length, 1);
      assert.equal(qr.items[0]!.historical, false);
      assert.equal(qr.items[0]!.failures, 2);
      const restoreQuizStates = new Error("RESTORE_QUIZ_STATES");
      await tx
        .transaction(async (inner) => {
          await inner.execute(
            sql`update quiz_attempt_item set is_correct=true where attempt_id in(select id from quiz_attempt where user_id=${owner} and collection_id=${quiz} and status='completed')`,
          );
          assert.equal(
            (await getStudyRanking(inner as unknown as Database, owner, rankingInput, "quizzes"))
              .emptyReason,
            "noDifficulty",
          );
          await inner.execute(
            sql`update quiz_attempt_item set is_correct=false where attempt_id in(select id from quiz_attempt where user_id=${owner} and collection_id=${quiz} and status='completed')`,
          );
          assert.equal(
            (
              await getStudyRanking(
                inner as unknown as Database,
                owner,
                { ...rankingInput, order: "correct" },
                "quizzes",
              )
            ).emptyReason,
            "noSuccess",
          );
          await inner
            .update(quizCollection)
            .set({ archivedAt: new Date() })
            .where(eq(quizCollection.id, quiz));
          assert.equal(
            (await getStudyRanking(inner as unknown as Database, owner, rankingInput, "quizzes"))
              .emptyReason,
            "onlyArchived",
          );
          throw restoreQuizStates;
        })
        .catch((error: unknown) => {
          if (error !== restoreQuizStates) throw error;
        });
      await tx
        .update(quizQuestion)
        .set({ content: content("Questão alterada") })
        .where(eq(quizQuestion.id, question));
      assert.equal(
        (await getStudyRanking(db, owner, rankingInput, "quizzes")).items[0]!.historical,
        true,
      );
      await tx.delete(quizQuestion).where(eq(quizQuestion.id, question));
      assert.equal(
        (await getStudyRanking(db, owner, rankingInput, "quizzes")).items[0]!.total,
        3,
        "Deleted question keeps historical identity",
      );
      assert.equal((await getStudyMetrics(db, owner, input, "quizzes")).summary.quizAnswers, 3);
      const historical = await getStudyAttempts(db, owner, rankingInput);
      const historicalResult = quizAttemptSchema.parse(
        await getQuizAttempt(db, owner, historical.items[0]!.id),
      );
      assert.equal(
        historicalResult.items[0]!.questionId,
        null,
        "Deleted live questions must not break historical review",
      );
      const overview = await getStudyMetrics(db, owner, input, "overview");
      assert.equal(overview.summary.evaluations, 46);
      assert.equal(overview.summary.quizAnswers, 3);
      // Unequal attempt lengths must be weighted by answers, not by attempt percentages.
      // A new snapshot version and a missing legacy identity must not inflate the old rank.
      for (const [version, size] of [
        ["Alterada", 3],
        ["Sem origem", 2],
      ] as const) {
        const attemptId = crypto.randomUUID();
        const snapshot = content(version);
        await tx.insert(quizAttempt).values({
          id: attemptId,
          userId: owner,
          collectionId: quiz,
          status: "completed",
          answeredQuestions: size,
          correctAnswers: size,
          totalQuestions: size,
          completedAt: new Date("2026-10-22T18:00:00Z"),
        });
        await tx.insert(quizAttemptItem).values(
          Array.from({ length: size }, (_, position) => ({
            id: crypto.randomUUID(),
            attemptId,
            questionId: null,
            originalQuestionId: version === "Sem origem" ? null : question,
            questionFingerprint: sql<string>`lazuli_quiz_fingerprint(${JSON.stringify(snapshot)}::jsonb,${JSON.stringify(options)}::jsonb,${options[0]!.id})`,
            position,
            question: snapshot,
            options,
            correctOptionId: options[0]!.id,
            selectedOptionId: options[0]!.id,
            isCorrect: true,
            answeredAt: new Date("2026-10-22T17:00:00Z"),
          })),
        );
      }
      const weighted = await getStudyMetrics(db, owner, input, "quizzes");
      assert.equal(weighted.summary.attempts, 5);
      const recent = await getStudyAttempts(db, owner, { ...rankingInput, recent: "true" });
      assert.equal(recent.items.length, 3);
      assert.equal(recent.hasMore, true);
      assert.equal(weighted.summary.quizAnswers, 8);
      assert.equal(
        weighted.summary.quizCorrect,
        6,
        "Weighted accuracy is 6/8, not mean attempt score",
      );
      const separated = await getStudyRanking(
        db,
        owner,
        { ...rankingInput, order: "correct" },
        "quizzes",
      );
      assert.equal(
        separated.items.length,
        1,
        "Unknown identities and one-attempt new versions do not qualify",
      );
      assert.equal(
        separated.items[0]!.total,
        3,
        "Changed versions never merge into original observations",
      );
      const app = Fastify();
      let authenticated = true;
      await app.register(
        createStudyMetricsRoutes({
          database: db,
          auth: {
            api: { getSession: async () => (authenticated ? { user: { id: owner } } : null) },
          } as unknown as Auth,
        }),
      );
      const query = new URLSearchParams(input).toString();
      assert.equal(
        (await app.inject(`/api/study-metrics/overview/summary?${query}`)).statusCode,
        200,
      );
      assert.equal(
        (await app.inject(`/api/study-metrics/flashcards/summary?${query}&collectionId=${foreign}`))
          .statusCode,
        404,
      );
      assert.equal(
        (
          await app.inject(
            `/api/study-metrics/overview/summary?${query.replace("America%2FSao_Paulo", "Not%2FAZone")}`,
          )
        ).statusCode,
        400,
      );
      authenticated = false;
      assert.equal(
        (await app.inject(`/api/study-metrics/overview/summary?${query}`)).statusCode,
        401,
      );
      await app.close();
      // Exercise real attempt creation against the new fingerprint function (no network calls).
      await tx
        .update(quizAttempt)
        .set({ status: "abandoned" })
        .where(and(eq(quizAttempt.userId, owner), eq(quizAttempt.status, "active")));
      const newQuestion = crypto.randomUUID();
      await tx.insert(quizQuestion).values({
        id: newQuestion,
        collectionId: quiz,
        content: content("Nova questão"),
        position: 0,
      });
      await tx.insert(quizOption).values(
        options.map((o, i) => ({
          ...o,
          id: crypto.randomUUID(),
          questionId: newQuestion,
          isCorrect: i === 0,
        })),
      );
      const created = await createQuizAttempt(db, owner, quiz, {
        id: crypto.randomUUID(),
        abandonActive: false,
      });
      assert.equal(created.kind, "ok");
      const [version] = await tx
        .select()
        .from(quizAttemptItem)
        .where(eq(quizAttemptItem.originalQuestionId, newQuestion));
      assert.ok(version?.questionFingerprint);
      // Day boundaries are calculated by PostgreSQL in the requested calendar, including DST.
      const [dst] = await tx.execute(sql`select extract(epoch from
        ('2026-03-09'::timestamp at time zone 'America/New_York')-
        ('2026-03-08'::timestamp at time zone 'America/New_York'))/3600 as hours`);
      assert.equal(Number(dst!.hours), 23);
      const boundary = crypto.randomUUID(),
        boundaryCard = crypto.randomUUID(),
        boundarySession = crypto.randomUUID(),
        boundaryItem = crypto.randomUUID();
      await tx
        .insert(flashcardCollection)
        .values({ id: boundary, userId: owner, title: "Limites de calendário" });
      await tx.insert(flashcard).values({
        id: boundaryCard,
        collectionId: boundary,
        question: content("Início de aprendizagem"),
        answer: content("Resposta"),
      });
      await tx.insert(flashcardPracticeSession).values({
        id: boundarySession,
        userId: owner,
        collectionId: boundary,
        status: "completed",
        totalCards: 1,
        reviewedCards: 1,
      });
      await tx.insert(flashcardPracticeItem).values({
        id: boundaryItem,
        sessionId: boundarySession,
        flashcardId: boundaryCard,
        position: 0,
      });
      await tx.insert(flashcardReview).values(
        [
          "2026-10-20T02:59:59.999Z",
          "2026-10-20T03:00:00Z",
          "2026-10-23T02:59:59.999Z",
          "2026-10-23T03:00:00Z",
        ].map((time) => ({
          id: crypto.randomUUID(),
          flashcardId: boundaryCard,
          sessionId: boundarySession,
          practiceItemId: boundaryItem,
          rating: "good" as const,
          reviewedAt: new Date(time),
          previousDueAt: new Date(time),
          nextDueAt: new Date(time),
          previousState: "learning" as const,
          nextState: "review" as const,
          stability: 1,
          difficulty: 2,
          elapsedDays: 0,
          scheduledDays: 1,
          learningSteps: 0,
          schedulerVersion: "test",
        })),
      );
      const boundaryReport = await getStudyMetrics(
        db,
        owner,
        { ...input, collectionId: boundary },
        "flashcards",
      );
      assert.equal(
        boundaryReport.summary.evaluations,
        2,
        "Inclusive local start / exclusive following midnight",
      );
      assert.equal(
        boundaryReport.summary.eligible,
        0,
        "Learning and same-day repetitions are not spaced recall",
      );
      // A bounded synthetic workload measures the exact aggregate SQL, with all fixtures rolled back.
      await tx.execute(sql`insert into flashcard_review (id,flashcard_id,session_id,practice_item_id,rating,reviewed_at,previous_due_at,next_due_at,previous_state,next_state,stability,difficulty,elapsed_days,scheduled_days,learning_steps,scheduler_version)
        select ${owner}||':benchmark:'||g,${boundaryCard},${boundarySession},${boundaryItem},'good','2026-10-20 15:00:00Z'::timestamptz+g*interval '1 second','2026-10-20 15:00:00Z','2026-10-25 15:00:00Z','review','review',2,3,1,1,0,'test' from generate_series(1,20000) g`);
      const timings: number[] = [];
      for (let run = 0; run < 12; run++) {
        const start = performance.now();
        await getStudyMetrics(db, owner, { ...input, compare: "false" }, "overview");
        timings.push(performance.now() - start);
      }
      const [explain] = await tx.execute(
        sql`explain (analyze,buffers,format json) ${metricsAggregateQuery(owner, { ...input, compare: "false" }, "overview")}`,
      );
      const plan = explain!["QUERY PLAN"] as { "Execution Time": number }[];
      console.log(
        JSON.stringify({
          workload: "20000 additional reviews, rollback",
          runs: timings.length,
          p95Ms: Math.round(
            timings.toSorted((a, b) => a - b)[Math.ceil(timings.length * 0.95) - 1]!,
          ),
          explainExecutionMs: plan[0]!["Execution Time"],
        }),
      );
      console.log(
        "PASS: metrics counts, repeated ratings, owner isolation, archive, pagination, quiz completion, versions/deletion, routes and attempt creation",
      );
      throw rollback;
    })
    .catch((e) => {
      if (e !== rollback) throw e;
    });
} finally {
  await connection.client.end({ timeout: 5 });
}
