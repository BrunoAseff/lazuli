import { randomUUID } from "node:crypto";

import { serverEnv } from "../config.ts";
import { createDatabase } from "../database/client.ts";
import { createLogger } from "../logger.ts";
import { createAiGenerationService } from "./ai-generation-service.ts";
import { createAiGenerationStore } from "./ai-generation-store.ts";
import { createOpenAiProvider } from "./openai-provider.ts";

const userId = process.env.AI_SMOKE_USER_ID;
if (!userId) throw new Error("AI_SMOKE_USER_ID must identify an existing local user");
if (!serverEnv.AI_REAL_CALLS_ENABLED)
  throw new Error("Set AI_REAL_CALLS_ENABLED=true explicitly to run the paid smoke test");

const database = createDatabase(serverEnv.DATABASE_URL);
const logger = createLogger(serverEnv);
const service = createAiGenerationService({
  logger,
  provider: createOpenAiProvider(serverEnv),
  store: createAiGenerationStore(database.db),
});

try {
  const result = await service.generateFoundationDraft({
    blocks: [
      {
        id: "retrieval-practice",
        text: "A prática de recuperação fortalece a memória ao exigir que a informação seja lembrada sem consulta imediata ao material.",
      },
    ],
    idempotencyKey: process.env.AI_SMOKE_IDEMPOTENCY_KEY ?? `foundation-smoke-${randomUUID()}`,
    sourceIds: ["manual-smoke-fixture"],
    userId,
  });
  logger.info(
    {
      kind: result.kind,
      operationId: result.operationId,
      reused: result.kind === "completed" ? result.reused : undefined,
    },
    "AI manual smoke test finished",
  );
} finally {
  await database.client.end({ timeout: 1 });
}
