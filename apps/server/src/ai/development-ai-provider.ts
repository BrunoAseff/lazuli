import type { AiProvider } from "./ai-provider.ts";

const readTag = (prompt: string, tag: string) => {
  const match = prompt.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match?.[1] ? JSON.parse(match[1]) : null;
};

const shortLiteralExcerpt = (value: string, maxLength = 120) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  const tail = normalized.slice(-maxLength);
  const firstWordEnd = tail.indexOf(" ");
  return (firstWordEnd === -1 ? tail : tail.slice(firstWordEnd + 1)).trim();
};

export const createDevelopmentAiProvider = (): AiProvider => ({
  model: "development-fixture",
  name: "development",
  requestTimeoutMs: 1_000,
  async generateStructured(request) {
    const generation = readTag(request.prompt, "REQUEST") as {
      action?: "materialImprovement";
      intent?:
        | "clarify"
        | "concise"
        | "improveOptions"
        | "reduceAmbiguity"
        | "reviewFromSource"
        | "splitConcepts";
      kind?: "flashcard" | "quizQuestion";
      quantity?: number;
    } | null;
    const current = readTag(request.prompt, "CURRENT_MATERIAL") as {
      question?: string;
      answer?: string;
      prompt?: string;
      options?: string[];
      correctOptionIndex?: number;
    } | null;
    const blocks = (readTag(request.prompt, "SOURCE_EVIDENCE") ??
      readTag(request.prompt, "SOURCE_SELECTION") ??
      []) as Array<{
      id: string;
      text: string;
    }>;
    const context = readTag(request.prompt, "SOURCE_CONTEXT") as {
      documentTitle?: string;
    } | null;
    const source = blocks
      .map(({ text }) => text)
      .join(" ")
      .trim();
    const isImageGeneration = Boolean(request.images?.length);
    // A material references only the most relevant subset of the source. The
    // development fixture uses the first blocks deterministically instead of
    // returning every block from a whole document and violating the contract.
    const sourceBlockIds = blocks.slice(0, 10).map(({ id }) => id);
    const quantity = Math.max(1, Math.min(10, generation?.quantity ?? 1));
    const summary = isImageGeneration
      ? "Conteúdo visual simulado no ambiente de desenvolvimento."
      : source.length > 220
        ? `${source.slice(0, 217)}…`
        : source;
    const references = blocks[0]
      ? [{ blockId: blocks[0].id, quote: shortLiteralExcerpt(blocks[0].text) }]
      : [];
    if (generation?.action === "materialImprovement") {
      const warning = blocks.length ? null : "Melhoria de redação feita sem uma fonte vinculada.";
      const improveQuestion = (value: string | undefined, fallback: string) => {
        const question = value?.trim() || fallback;
        const withoutQuestionMark = question.replace(/[?!.]+$/, "");

        switch (generation.intent) {
          case "concise":
            return `Explique: ${withoutQuestionMark}.`;
          case "reduceAmbiguity":
            return `Considerando o material estudado, ${question.charAt(0).toLowerCase()}${question.slice(1)}`;
          case "reviewFromSource":
            return `Segundo a fonte, ${question.charAt(0).toLowerCase()}${question.slice(1)}`;
          case "splitConcepts":
            return `Qual é o principal conceito relacionado a ${withoutQuestionMark.toLowerCase()}?`;
          case "improveOptions":
          case "clarify":
          default:
            return `Com base no conteúdo estudado, ${question.charAt(0).toLowerCase()}${question.slice(1)}`;
        }
      };
      const improveAnswer = (value: string | undefined) => {
        const answer = value?.trim() || summary;
        if (!answer) return "A fonte não contém informação suficiente para elaborar a resposta.";
        return generation.intent === "concise"
          ? answer.split(/(?<=[.!?])\s+/)[0] || answer
          : `Em síntese, ${answer.charAt(0).toLowerCase()}${answer.slice(1)}`;
      };
      const improvement =
        generation.kind === "flashcard"
          ? {
              question: improveQuestion(
                current?.question,
                "Qual é a ideia central deste material?",
              ),
              answer: improveAnswer(current?.answer),
              warning,
            }
          : {
              prompt: improveQuestion(current?.prompt, "Qual alternativa é sustentada pela fonte?"),
              options:
                current?.options && current.options.length >= 4
                  ? current.options
                  : [
                      summary || "A alternativa sustentada pelo material.",
                      "Uma afirmação que contradiz a fonte.",
                      "Uma informação não sustentada pela fonte.",
                      "Nenhuma das alternativas anteriores.",
                    ],
              correctOptionIndex: current?.correctOptionIndex ?? 0,
              sourceBlockIds,
              warning,
            };
      return {
        effectiveModel: "development-fixture",
        output: request.schema.parse(improvement),
        providerRequestId: null,
        usage: { cachedInputTokens: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      };
    }
    const output = {
      flashcards:
        generation?.kind === "flashcard"
          ? Array.from({ length: quantity }, (_, index) => ({
              answer: summary,
              evidence: summary,
              question: isImageGeneration
                ? `Qual é a ideia central desta imagem${quantity > 1 ? ` (${index + 1})` : ""}?`
                : `Qual é a ideia central de ${context?.documentTitle ?? "este assunto"}${quantity > 1 ? ` (${index + 1})` : ""}?`,
              sourceBlockIds,
              references,
              warning: null,
            }))
          : [],
      quizQuestions:
        generation?.kind === "quizQuestion"
          ? Array.from({ length: quantity }, (_, index) => ({
              correctOptionIndex: 0,
              evidence: summary,
              options: [
                summary,
                "Uma afirmação que contradiz a ideia central da fonte.",
                "Uma informação relacionada, mas não sustentada pela fonte.",
                "Nenhuma das afirmações apresentadas é sustentada pela fonte.",
              ],
              prompt: isImageGeneration
                ? `Qual alternativa descreve a imagem${quantity > 1 ? ` (${index + 1})` : ""}?`
                : `Qual alternativa está correta sobre ${context?.documentTitle ?? "o assunto estudado"}${quantity > 1 ? ` (${index + 1})` : ""}?`,
              sourceBlockIds,
              references,
              warning: null,
            }))
          : [],
    };
    return {
      effectiveModel: "development-fixture",
      output: request.schema.parse(output),
      providerRequestId: null,
      usage: { cachedInputTokens: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
  },
});
