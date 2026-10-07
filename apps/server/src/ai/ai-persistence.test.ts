import { describe, expect, it } from "vitest";

import { createPersistedQuizOptions } from "./ai-persistence.ts";

describe("AI material persistence", () => {
  it("generates server-owned option IDs and maps only accepted fields", () => {
    const clientOptions = [{ id: "client-controlled", isCorrect: true, text: "Resposta" }];
    const [option] = createPersistedQuizOptions("question-1", clientOptions);

    expect(option).toMatchObject({
      isCorrect: true,
      position: 0,
      questionId: "question-1",
      text: "Resposta",
    });
    expect(option?.id).not.toBe("client-controlled");
    expect(option?.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
