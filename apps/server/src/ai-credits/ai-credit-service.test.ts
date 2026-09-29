import { describe, expect, it } from "vitest";

import type { Database } from "../database/client.ts";
import { createAiCreditService } from "./ai-credit-service.ts";

const service = createAiCreditService({} as Database);

describe("AI credit administrative validation", () => {
  it("requires auditable metadata before touching the database", async () => {
    await expect(
      service.adjust({
        amount: 10,
        idempotencyKey: "",
        operatorId: "operator-1",
        reason: "Correção",
        userId: "user-1",
      }),
    ).rejects.toThrow("administrative metadata");
  });

  it("rejects zero adjustments and negative grants", async () => {
    await expect(
      service.adjust({
        amount: 0,
        idempotencyKey: "adjustment-1",
        operatorId: "operator-1",
        reason: "Correção",
        userId: "user-1",
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
