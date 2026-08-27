import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";

import type { ServerEnv } from "./config.ts";
import { createAuth } from "./auth/auth.ts";
import { createDatabase } from "./database/client.ts";
import { createDocumentRoutes } from "./documents/document-routes.ts";
import { createDocumentAssetRoutes } from "./documents/document-asset-routes.ts";
import { createDocumentImportRoutes } from "./document-imports/document-import-routes.ts";
import { createDocumentImportWorker } from "./document-imports/document-import-worker.ts";
import { createFlashcardCollectionRoutes } from "./flashcards/flashcard-collection-routes.ts";
import { createFlashcardRoutes } from "./flashcards/flashcard-routes.ts";
import { createFlashcardPracticeRoutes } from "./flashcards/flashcard-practice-routes.ts";
import { createLogger } from "./logger.ts";
import { createProjectRoutes } from "./projects/project-routes.ts";
import { createQuizCollectionRoutes } from "./quizzes/quiz-collection-routes.ts";
import { createQuizRoutes } from "./quizzes/quiz-routes.ts";
import { createAuthRoutes } from "./routes/auth-routes.ts";
import { healthRoutes } from "./routes/health.ts";
import { createObjectStorage } from "./storage/object-storage.ts";

export const buildApp = (env: ServerEnv) => {
  const app = Fastify({
    loggerInstance: createLogger(env),
  });
  const database = createDatabase(env.DATABASE_URL);
  const auth = createAuth(env, database.db, app.log);
  const storage = createObjectStorage(env);
  const importWorker = createDocumentImportWorker(database.db, storage, app.log);

  void app.register(cors, {
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    origin: env.WEBSITE_URL,
  });
  void app.register(multipart, { limits: { files: 1 } });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "unhandled request error");
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;
    const clientError = statusCode >= 400 && statusCode < 500;
    return reply.status(clientError ? statusCode : 500).send({
      code: clientError ? "REQUEST_ERROR" : "INTERNAL_ERROR",
      message: clientError
        ? "Não foi possível processar esta solicitação."
        : "Não foi possível concluir esta operação.",
    });
  });

  app.register(createAuthRoutes(auth, env));
  app.register(
    createProjectRoutes({
      auth,
      database: database.db,
      websiteUrl: env.WEBSITE_URL,
    }),
  );
  app.register(createDocumentRoutes({ auth, database: database.db, websiteUrl: env.WEBSITE_URL }));
  app.register(
    createFlashcardCollectionRoutes({
      auth,
      database: database.db,
      websiteUrl: env.WEBSITE_URL,
    }),
  );
  app.register(
    createFlashcardRoutes({
      auth,
      database: database.db,
      storage,
      websiteUrl: env.WEBSITE_URL,
    }),
  );
  app.register(
    createFlashcardPracticeRoutes({
      auth,
      database: database.db,
      websiteUrl: env.WEBSITE_URL,
    }),
  );
  app.register(
    createQuizCollectionRoutes({
      auth,
      database: database.db,
      websiteUrl: env.WEBSITE_URL,
    }),
  );
  app.register(
    createQuizRoutes({ auth, database: database.db, storage, websiteUrl: env.WEBSITE_URL }),
  );
  app.register(
    createDocumentAssetRoutes({
      auth,
      database: database.db,
      storage,
      websiteUrl: env.WEBSITE_URL,
    }),
  );
  app.register(
    createDocumentImportRoutes({
      auth,
      database: database.db,
      storage,
      websiteUrl: env.WEBSITE_URL,
    }),
  );
  app.register(healthRoutes);

  app.addHook("onClose", async () => {
    await importWorker.stop();
    storage.destroy();
    await database.client.end({ timeout: 1 });
  });

  if (env.NODE_ENV !== "test")
    app.addHook("onReady", async () => {
      await storage.ensureBucket();
      importWorker.start();
    });

  return app;
};
