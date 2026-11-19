import { ChoiceSeal } from "@/components/study-answer-choice.tsx";
import {
  AI_CREDITS_PER_ITEM,
  collectDocumentTextBlocks,
  type AiImprovementIntent,
  type AiMaterialImprovementDraft,
  type ApplyAiMaterialImprovementInput,
  type DocumentBlock,
  type FlashcardDetail,
  type QuizQuestionDetail,
} from "@lazuli/shared";
import { AiCreditCost } from "./ai-credit-cost.tsx";
import { MagicWandIcon } from "@/components/icons.tsx";
import { CircleNotchIcon } from "@/components/icons.tsx";
import { ArrowClockwiseIcon } from "@/components/icons.tsx";
import { CheckIcon } from "@/components/icons.tsx";
import { Trash2Icon } from "@/components/icons.tsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmationDialog } from "@/components/confirmation-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group.tsx";
import { CreationWorkspace } from "./creation-workspace.tsx";
import { ReferenceManager } from "@/features/references/components/reference-manager.tsx";
import { CreditUpgradeGuard } from "@/features/billing/components/credit-upgrade-guard.tsx";
import {
  QuizAlternativesField,
  type QuizOptionDraft,
} from "@/features/quizzes/components/quiz-alternatives-field.tsx";
import {
  useAiCreditBalance,
  useAiMaterialImprovement,
  useApplyAiMaterialImprovement,
  useCreateAiMaterialImprovement,
  useDiscardAiMaterialImprovement,
} from "../api/ai-queries.ts";

const intentLabels: Record<AiImprovementIntent, string> = {
  clarify: "Deixar mais claro",
  reduceAmbiguity: "Reduzir ambiguidades",
  concise: "Tornar mais conciso",
  splitConcepts: "Focar em um conceito",
  improveOptions: "Melhorar alternativas",
  reviewFromSource: "Revisar pelas fontes",
};

const textContent = (text: string): DocumentBlock[] => [
  {
    id: crypto.randomUUID(),
    type: "paragraph",
    content: [{ type: "text", text: text.trim(), styles: {} }],
  },
];

const richText = (content: unknown) =>
  collectDocumentTextBlocks(content as DocumentBlock[])
    .map(({ text }) => text)
    .join(" ")
    .trim();

type Material =
  | { kind: "flashcard"; value: FlashcardDetail }
  | { kind: "quizQuestion"; value: QuizQuestionDetail };

export const AiMaterialImprovementDialog = ({
  material,
  onApplied,
  onOpenChange,
  open,
}: {
  material: Material;
  onApplied?: (input: ApplyAiMaterialImprovementInput) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const [intent, setIntent] = useState<AiImprovementIntent>("clarify");
  const [guidance, setGuidance] = useState("");
  const [operationId, setOperationId] = useState("");
  const [draft, setDraft] = useState<AiMaterialImprovementDraft | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [quizPrompt, setQuizPrompt] = useState("");
  const [quizOptions, setQuizOptions] = useState<QuizOptionDraft[]>([]);
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false);
  const [closeAfterDiscard, setCloseAfterDiscard] = useState(false);
  const generationRequest = useRef(0);
  const balance = useAiCreditBalance();
  const create = useCreateAiMaterialImprovement();
  const generation = useAiMaterialImprovement(operationId);
  const apply = useApplyAiMaterialImprovement(operationId);
  const discard = useDiscardAiMaterialImprovement(operationId);
  const result = generation.data?.status === "completed" ? generation.data.draft : null;
  const busy = create.isPending || generation.data?.status === "running";

  const availableIntents = useMemo<AiImprovementIntent[]>(
    () =>
      material.kind === "flashcard"
        ? ["clarify", "reduceAmbiguity", "concise", "splitConcepts", "reviewFromSource"]
        : ["clarify", "reduceAmbiguity", "concise", "improveOptions", "reviewFromSource"],
    [material.kind],
  );

  useEffect(() => {
    if (!result || result.operationId === draft?.operationId) return;
    setDraft(result);
    if (result.kind === "flashcard") {
      setQuestion(result.proposed.question);
      setAnswer(result.proposed.answer);
    } else {
      setQuizPrompt(result.proposed.prompt);
      setQuizOptions(
        result.proposed.options.map((text, index) => ({
          id: crypto.randomUUID(),
          isCorrect: index === result.proposed.correctOptionIndex,
          text,
        })),
      );
    }
  }, [draft?.operationId, result]);

  useEffect(() => {
    if (!operationId || !generation.isError) return;
    toast.error("A geração da melhoria falhou. Tente novamente.");
    setOperationId("");
  }, [generation.isError, operationId]);

  const generate = async (regenerate = false) => {
    const request = ++generationRequest.current;
    try {
      const response = await create.mutateAsync({
        idempotencyKey: crypto.randomUUID(),
        kind: material.kind,
        collectionId: material.value.collectionId,
        materialId: material.value.id,
        intent,
        guidance,
        ...(regenerate && draft ? { regenerateOperationId: draft.operationId } : {}),
      });
      if (request !== generationRequest.current) return;
      if (response.status === "completed") {
        setOperationId(response.draft.operationId);
      } else setOperationId(response.operationId);
    } catch {
      if (request !== generationRequest.current) return;
      toast.error("Não foi possível gerar a melhoria.");
    }
  };

  const applyDraft = async () => {
    if (!draft) return;
    try {
      let appliedInput: ApplyAiMaterialImprovementInput;
      if (draft.kind === "flashcard") {
        if (!question.trim() || !answer.trim()) return;
        appliedInput = {
          kind: "flashcard",
          expectedUpdatedAt: draft.materialUpdatedAt,
          question: textContent(question),
          answer: textContent(answer),
        };
      } else {
        const correct = quizOptions.filter(({ isCorrect }) => isCorrect);
        if (
          !quizPrompt.trim() ||
          correct.length !== 1 ||
          quizOptions.some(({ text }) => !text.trim())
        )
          return;
        appliedInput = {
          kind: "quizQuestion",
          expectedUpdatedAt: draft.materialUpdatedAt,
          content: textContent(quizPrompt),
          options: quizOptions.map(({ id, isCorrect, text }) => ({
            id,
            isCorrect,
            text: text.trim(),
          })),
        };
      }
      await apply.mutateAsync(appliedInput);
      onApplied?.(appliedInput);
      toast.success("Melhoria aplicada ao material.");
      generationRequest.current += 1;
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível aplicar a melhoria. O material pode ter sido alterado.");
    }
  };

  const reset = () => {
    setOperationId("");
    setDraft(null);
    setQuestion("");
    setAnswer("");
    setQuizPrompt("");
    setQuizOptions([]);
  };

  const discardDraft = async () => {
    if (!draft) return;
    try {
      await discard.mutateAsync();
      generationRequest.current += 1;
      reset();
      setDiscardConfirmationOpen(false);
      if (closeAfterDiscard) onOpenChange(false);
      setCloseAfterDiscard(false);
    } catch {
      toast.error("Não foi possível descartar a proposta.");
    }
  };

  const requestClose = () => {
    if (apply.isPending) return;
    if (draft) {
      setCloseAfterDiscard(true);
      setDiscardConfirmationOpen(true);
      return;
    }
    generationRequest.current += 1;
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && requestClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="pr-8">
            Refinar {material.kind === "flashcard" ? "flashcard" : "questão"}
          </DialogTitle>
          <DialogDescription>
            Revise a sugestão antes de alterar o material original.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-6 lazuli-thin-scrollbar md:overflow-hidden">
          <CreationWorkspace
            reviewing={Boolean(draft)}
            sourceLabel="Material atual"
            source={
              material.kind === "flashcard" ? (
                <div className="space-y-6">
                  <h3>
                    {richText(
                      draft?.kind === "flashcard"
                        ? draft.current.question
                        : material.value.question,
                    )}
                  </h3>
                  <p>
                    {richText(
                      draft?.kind === "flashcard" ? draft.current.answer : material.value.answer,
                    )}
                  </p>
                </div>
              ) : (
                <div>
                  <h3>
                    {richText(
                      draft?.kind === "quizQuestion"
                        ? draft.current.content
                        : material.value.content,
                    )}
                  </h3>
                  <ol className="mt-5 space-y-3 font-sans text-sm">
                    {(draft?.kind === "quizQuestion"
                      ? draft.current.options
                      : material.value.options
                    ).map((option, index) => (
                      // Same anatomy as the quiz: letter seal, the correct one sealed in green.
                      <li
                        key={index}
                        className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3"
                      >
                        <ChoiceSeal
                          filled={false}
                          index={index}
                          outcome={option.isCorrect ? "correct" : undefined}
                        />
                        <span
                          className={
                            option.isCorrect ? "pt-1 text-foreground" : "pt-1 text-muted-foreground"
                          }
                        >
                          {option.text}
                          {option.isCorrect && <span className="sr-only"> (resposta correta)</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )
            }
          >
            {!draft ? (
              <div className="grid items-start gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="ai-improvement-intent">Como melhorar?</Label>
                  <RadioGroup
                    aria-label="Como melhorar?"
                    value={intent}
                    onValueChange={(value) => {
                      if (availableIntents.includes(value as AiImprovementIntent))
                        setIntent(value as AiImprovementIntent);
                    }}
                  >
                    {availableIntents.map((value) => (
                      <RadioCard key={value} title={intentLabels[value]} value={value} />
                    ))}
                  </RadioGroup>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ai-improvement-guidance">Orientação (opcional)</Label>
                  <Textarea
                    id="ai-improvement-guidance"
                    maxLength={500}
                    onChange={(event) => setGuidance(event.target.value)}
                    placeholder="Ex.: preserve os termos técnicos e reduza a resposta."
                    value={guidance}
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-7">
                <div>
                  <section className="grid gap-4">
                    <p className="text-xs font-medium text-muted-foreground">Sugestão editável</p>
                    {draft.kind === "flashcard" ? (
                      <>
                        <div className="grid gap-2">
                          <Label htmlFor="improved-question">Pergunta</Label>
                          <Textarea
                            id="improved-question"
                            onChange={(event) => setQuestion(event.target.value)}
                            value={question}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="improved-answer">Resposta</Label>
                          <Textarea
                            id="improved-answer"
                            onChange={(event) => setAnswer(event.target.value)}
                            value={answer}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid gap-2">
                          <Label htmlFor="improved-prompt">Pergunta</Label>
                          <Textarea
                            id="improved-prompt"
                            onChange={(event) => setQuizPrompt(event.target.value)}
                            value={quizPrompt}
                          />
                        </div>
                        <QuizAlternativesField onChange={setQuizOptions} options={quizOptions} />
                      </>
                    )}
                  </section>
                </div>
                {draft.warning && <p className="text-sm text-muted-foreground">{draft.warning}</p>}
                <section>
                  <ReferenceManager
                    returnTo={
                      draft.kind === "flashcard"
                        ? `/flashcards/${draft.collectionId}?card=${draft.materialId}`
                        : `/quizzes/${draft.collectionId}?question=${draft.materialId}`
                    }
                    target={{
                      type: draft.kind === "flashcard" ? "flashcard" : "quizQuestion",
                      id: draft.materialId,
                    }}
                  />
                </section>
              </div>
            )}
          </CreationWorkspace>
        </div>
        <DialogFooter className="mx-0 mb-0 flex-col border-t px-6 py-4 sm:items-center">
          {!draft && (
            <div className="w-full sm:mr-auto sm:w-auto">
              <AiCreditCost cost={AI_CREDITS_PER_ITEM} available={balance.data?.available} />
            </div>
          )}
          {draft ? (
            <>
              <Button
                className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
                disabled={discard.isPending || apply.isPending}
                onClick={() => {
                  setCloseAfterDiscard(false);
                  setDiscardConfirmationOpen(true);
                }}
                variant="ghost"
              >
                <Trash2Icon /> Descartar proposta
              </Button>
              <Button
                disabled={busy || apply.isPending}
                onClick={() => void generate(true)}
                variant="outline"
              >
                {busy ? <CircleNotchIcon className="animate-spin" /> : <ArrowClockwiseIcon />}
                Refazer
              </Button>
              <Button disabled={apply.isPending} onClick={() => void applyDraft()}>
                {apply.isPending ? <CircleNotchIcon className="animate-spin" /> : <CheckIcon />}
                Aplicar melhoria
              </Button>
            </>
          ) : (
            <>
              <DialogCancelButton disabled={apply.isPending} onClick={requestClose}>
                Fechar
              </DialogCancelButton>
              <CreditUpgradeGuard available={balance.data?.available} cost={AI_CREDITS_PER_ITEM}>
                <Button
                  disabled={busy || (balance.data?.available ?? 0) < AI_CREDITS_PER_ITEM}
                  onClick={() => void generate()}
                >
                  {busy ? <CircleNotchIcon className="animate-spin" /> : <MagicWandIcon />} Gerar
                  proposta
                </Button>
              </CreditUpgradeGuard>
            </>
          )}
        </DialogFooter>
      </DialogContent>
      <ConfirmationDialog
        actionLabel="Descartar proposta"
        description="A proposta será removida e não poderá ser recuperada. Os créditos usados na geração não serão devolvidos."
        destructive
        disabled={discard.isPending}
        onConfirm={discardDraft}
        onOpenChange={(nextOpen) => {
          setDiscardConfirmationOpen(nextOpen);
          if (!nextOpen) setCloseAfterDiscard(false);
        }}
        open={discardConfirmationOpen}
        title="Descartar esta proposta?"
      />
    </Dialog>
  );
};
