import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rawBody from "fastify-raw-body";
import Fastify from "fastify";

import { createAiCreditReconciler } from "./ai-credits/ai-credit-reconciler.ts";
import { createAccountDeletionLifecycle } from "./account-settings/account-deletion.ts";
import { createAccountExportWorker } from "./account-settings/account-export-worker.ts";
import { createAccountSettingsRoutes } from "./account-settings/account-settings-routes.ts";
import { createAnalyticsRoutes } from "./analytics/analytics-routes.ts";
import { createAnalyticsService } from "./analytics/analytics-service.ts";
import { createAiCreditRoutes } from "./ai-credits/ai-credit-routes.ts";
import { createAiCreditService } from "./ai-credits/ai-credit-service.ts";
import { createAiGenerationRoutes } from "./ai/ai-generation-routes.ts";
import { createAiCollectionWorker } from "./ai/ai-collection-worker.ts";
import { createAiGenerationService } from "./ai/ai-generation-service.ts";
import { createAiGenerationStore } from "./ai/ai-generation-store.ts";
import { createDevelopmentAiProvider } from "./ai/development-ai-provider.ts";
import { createOpenAiProvider } from "./ai/openai-provider.ts";
import type { ServerEnv } from "./config.ts";
import { createAuth } from "./auth/auth.ts";
import { createCommercialRoutes } from "./commercial/commercial-routes.ts";
import { createCommercialMaintenanceService } from "./commercial/commercial-maintenance-service.ts";
import { createCommercialMaintenanceWorker } from "./commercial/commercial-maintenance-worker.ts";
import { createStripeBillingService } from "./commercial/stripe-billing-service.ts";
import { createDatabase } from "./database/client.ts";
import { createDashboardRoutes } from "./dashboard/dashboard-routes.ts";
import { createDocumentRoutes } from "./documents/document-routes.ts";
import { createDocumentAssetRoutes } from "./documents/document-asset-routes.ts";
import { createDocumentImportRoutes } from "./document-imports/document-import-routes.ts";
import { createDocumentImportWorker } from "./document-imports/document-import-worker.ts";
import { createFlashcardCollectionRoutes } from "./flashcards/flashcard-collection-routes.ts";
import { createFlashcardRoutes } from "./flashcards/flashcard-routes.ts";
import { createFlashcardPracticeRoutes } from "./flashcards/flashcard-practice-routes.ts";
import { createLogger } from "./logger.ts";
import { createProjectRoutes } from "./projects/project-routes.ts";
import { createProjectCoverRoutes } from "./projects/project-cover-routes.ts";
import { createQuizCollectionRoutes } from "./quizzes/quiz-collection-routes.ts";
import { createQuizRoutes } from "./quizzes/quiz-routes.ts";
import { createReferenceRoutes } from "./references/reference-routes.ts";
import { createAuthRoutes } from "./routes/auth-routes.ts";
import { healthRoutes } from "./routes/health.ts";
import { createFavoriteRoutes } from "./favorites/favorite-routes.ts";
import { createGlobalSearchRoutes } from "./search/global-search-routes.ts";
import { createLifecycleEmailWorker } from "./email/email-worker.ts";
import { createObjectStorage } from "./storage/object-storage.ts";

export const buildApp = (env: ServerEnv) => {
  const app = Fastify({
    loggerInstance: createLogger(env),
    trustProxy: env.TRUST_PROXY,
  });
  const database = createDatabase(env.DATABASE_URL);
  const analytics = createAnalyticsService(env, database.db, app.log);
  const storage = createObjectStorage(env);
  const stripeBilling = createStripeBillingService(env, database.db, analytics);
  const accountDeletion = createAccountDeletionLifecycle({
    database: database.db,
    logger: app.log,
    storage,
    stripe: stripeBilling,
  });
  const auth = createAuth(env, database.db, app.log, accountDeletion);
  const accountExportWorker = createAccountExportWorker(database.db, storage, env, app.log);
  const lifecycleEmailWorker = createLifecycleEmailWorker(database.db, storage, env, app.log);
  const importWorker = createDocumentImportWorker(
    database.db,
    storage,
    app.log,
    env.COMMERCIAL_LIMITS_ENFORCED,
    analytics,
  );
  const aiCreditService = createAiCreditService(database.db);
  const aiCreditReconciler = createAiCreditReconciler(aiCreditService, app.log);
  const aiGenerationService = createAiGenerationService({
    analytics,
    logger: app.log,
    provider: env.AI_REAL_CALLS_ENABLED ? createOpenAiProvider(env) : createDevelopmentAiProvider(),
    store: createAiGenerationStore(database.db),
  });
  const aiCollectionWorker = createAiCollectionWorker(database.db, aiGenerationService, app.log);
  const commercialMaintenanceWorker = createCommercialMaintenanceWorker(
    createCommercialMaintenanceService(database.db, stripeBilling),
    app.log,
  );

  void app.register(cors, {
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    origin: env.WEBSITE_URL,
  });
  void app.register(multipart, { limits: { files: 1 } });
  void app.register(rawBody, { encoding: false, global: false, runFirst: true });

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
  app.register(createFavoriteRoutes({ auth, database: database.db, websiteUrl: env.WEBSITE_URL }));
  app.register(
    createProjectCoverRoutes({
      auth,
      database: database.db,
      storage,
      websiteUrl: env.WEBSITE_URL,
      enforceCommercialLimits: env.COMMERCIAL_LIMITS_ENFORCED,
    }),
  );
  app.register(
    createGlobalSearchRoutes({ auth, database: database.db, websiteUrl: env.WEBSITE_URL }),
  );
  app.register(
    createAccountSettingsRoutes({
      auth,
      database: database.db,
      googleEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      rollbackAccountDeletion: (userId) => accountDeletion.rollback(userId),
      websiteUrl: env.WEBSITE_URL,
    }),
  );
  app.register(createAnalyticsRoutes({ auth, database: database.db, websiteUrl: env.WEBSITE_URL }));
  app.register(
    createCommercialRoutes({
      analytics,
      auth,
      database: database.db,
      stripe: stripeBilling,
      websiteUrl: env.WEBSITE_URL,
    }),
  );
  app.register(createDashboardRoutes({ auth, database: database.db, websiteUrl: env.WEBSITE_URL }));
  app.register(createAiCreditRoutes({ auth, service: aiCreditService }));
  app.register(
    createAiGenerationRoutes({
      analytics,
      auth,
      database: database.db,
      service: aiGenerationService,
      storage,
      websiteUrl: env.WEBSITE_URL,
    }),
  );
  app.register(
    createProjectRoutes({
      analytics,
      auth,
      database: database.db,
      enforceCommercialLimits: env.COMMERCIAL_LIMITS_ENFORCED,
      websiteUrl: env.WEBSITE_URL,
    }),
  );
  app.register(
    createDocumentRoutes({
      analytics,
      auth,
      database: database.db,
      websiteUrl: env.WEBSITE_URL,
    }),
  );
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
      enforceCommercialLimits: env.COMMERCIAL_LIMITS_ENFORCED,
      storage,
      websiteUrl: env.WEBSITE_URL,
    }),
  );
  app.register(
    createFlashcardPracticeRoutes({
      analytics,
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
    createQuizRoutes({
      analytics,
      auth,
      database: database.db,
      enforceCommercialLimits: env.COMMERCIAL_LIMITS_ENFORCED,
      storage,
      websiteUrl: env.WEBSITE_URL,
    }),
  );
  app.register(createReferenceRoutes({ auth, database: database.db, websiteUrl: env.WEBSITE_URL }));
  app.register(
    createDocumentAssetRoutes({
      auth,
      database: database.db,
      enforceCommercialLimits: env.COMMERCIAL_LIMITS_ENFORCED,
      storage,
      websiteUrl: env.WEBSITE_URL,
    }),
  );
  app.register(
    createDocumentImportRoutes({
      auth,
      database: database.db,
      enforceCommercialLimits: env.COMMERCIAL_LIMITS_ENFORCED,
      storage,
      websiteUrl: env.WEBSITE_URL,
    }),
  );
  app.register(healthRoutes);

  app.addHook("onClose", async () => {
    await lifecycleEmailWorker.stop();
    aiCreditReconciler.stop();
    commercialMaintenanceWorker.stop();
    aiCollectionWorker.stop();
    await accountExportWorker.stop();
    await importWorker.stop();
    await analytics.shutdown();
    storage.destroy();
    await database.client.end({ timeout: 1 });
  });

  if (env.NODE_ENV !== "test")
    app.addHook("onReady", async () => {
      await storage.ensureBucket();
      importWorker.start();
      accountExportWorker.start();
      lifecycleEmailWorker.start();
      aiCollectionWorker.start();
      aiCreditReconciler.start();
      commercialMaintenanceWorker.start();
    });

  return app;
};
