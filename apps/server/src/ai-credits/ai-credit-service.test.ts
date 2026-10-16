import { describe, expect, it } from "vitest";

import type { Database } from "../database/client.ts";
import { createAiCreditService } from "./ai-credit-service.ts";

const service = createAiCreditService({} as Database);

describe("AI credit administrative validation", () => {
  it("requires auditable metadata before touching the database", async () => {
    await expect(
      service.grant({
        amount: 10,
        email: "ana@example.com",
        idempotencyKey: "",
        operatorId: "operator-1",
        reason: "Correção",
      }),
    ).rejects.toThrow("administrative metadata");
  });

  it("rejects zero and negative grants", async () => {
    await expect(
      service.grant({
        amount: 0,
        email: "ana@example.com",
        idempotencyKey: "adjustment-1",
        operatorId: "operator-1",
        reason: "Correção",
      }),
    ).rejects.toThrow("non-zero");
    await expect(
      service.grant({
        amount: -10,
        idempotencyKey: "grant-1",
        operatorId: "operator-1",
        reason: "Teste",
        userId: "user-1",
      }),
    ).rejects.toThrow("grants must be positive");
  });
});
