import type { QuizAttempt } from "@lazuli/shared";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  putQuizAnswer: vi.fn(),
  postCompleteQuizAttempt: vi.fn(),
}));
vi.mock("./quiz-api.ts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  putQuizAnswer: api.putQuizAnswer,
  postCompleteQuizAttempt: api.postCompleteQuizAttempt,
}));

const { answerQuizMutation, completeQuizMutation, quizKeys } = await import("./quiz-queries.ts");

const attemptId = "attempt";
const key = quizKeys.attempt(attemptId);

const attempt = (choices: Record<string, string | null>, status = "active") =>
  ({
    id: attemptId,
    status,
    answeredQuestions: Object.values(choices).filter(Boolean).length,
    totalQuestions: Object.keys(choices).length,
    items: Object.entries(choices).map(([id, selectedOptionId]) => ({ id, selectedOptionId })),
  }) as unknown as QuizAttempt;

const choicesOf = (client: QueryClient) => {
  const data = client.getQueryData<QuizAttempt>(key)!;
  return {
    status: data.status,
    answered: data.answeredQuestions,
    items: Object.fromEntries(
      (data.items as Array<{ id: string; selectedOptionId: string | null }>).map((item) => [
        item.id,
        item.selectedOptionId,
      ]),
    ),
  };
};

/** A promise the test settles by hand, to order the server's replies. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
};

const answer = (client: QueryClient, itemId: string, optionId: string) =>
  new MutationObserver(client, answerQuizMutation(client, attemptId))
    .mutate({ itemId, optionId })
    .catch(() => undefined);

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => vi.clearAllMocks());

describe("quiz answers", () => {
  it("undoes only the failed choices when answers in a row fail", async () => {
    const client = new QueryClient();
    client.setQueryData(key, attempt({ q1: null, q2: null }));
    const first = deferred();
    const second = deferred();
    api.putQuizAnswer.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const one = answer(client, "q1", "a");
    const two = answer(client, "q2", "b");
    await settle();
    expect(choicesOf(client).items).toEqual({ q1: "a", q2: "b" });

    first.reject(new Error("offline"));
    await settle();
    // The second choice, still on its way, stays.
    expect(choicesOf(client).items).toEqual({ q1: null, q2: "b" });

    second.reject(new Error("offline"));
    await Promise.all([one, two]);
    expect(choicesOf(client)).toMatchObject({ answered: 0, items: { q1: null, q2: null } });
  });

  it("keeps a later choice of the same question when the earlier one fails", async () => {
    const client = new QueryClient();
    client.setQueryData(key, attempt({ q1: null }));
    const first = deferred();
    const second = deferred();
    api.putQuizAnswer.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const one = answer(client, "q1", "a");
    const two = answer(client, "q1", "b");
    await settle();
    first.reject(new Error("offline"));
    await settle();
    expect(choicesOf(client).items).toEqual({ q1: "b" });

    second.resolve(attempt({ q1: "b" }));
    await Promise.all([one, two]);
    expect(choicesOf(client).items).toEqual({ q1: "b" });
  });

  it("finishes only after the last answer, and never goes back to active", async () => {
    const client = new QueryClient();
    client.setQueryData(key, attempt({ q1: "a", q2: null }));
    const reply = deferred();
    api.putQuizAnswer.mockReturnValueOnce(reply.promise);
    api.postCompleteQuizAttempt.mockResolvedValue(attempt({ q1: "a", q2: "b" }, "completed"));

    const pending = answer(client, "q2", "b");
    const finish = new MutationObserver(client, completeQuizMutation(client, attemptId)).mutate();
    await settle();
    // The completion waits in the same queue as the answer.
    expect(api.postCompleteQuizAttempt).not.toHaveBeenCalled();

    reply.resolve(attempt({ q1: "a", q2: "b" }));
    await Promise.all([pending, finish]);
    expect(api.postCompleteQuizAttempt).toHaveBeenCalledOnce();
    expect(choicesOf(client).status).toBe("completed");
  });
});
