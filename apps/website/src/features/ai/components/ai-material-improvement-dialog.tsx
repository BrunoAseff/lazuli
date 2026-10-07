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
import { CoinsIcon } from "@phosphor-icons/react/Coins";
import { MagicWandIcon } from "@phosphor-icons/react/MagicWand";
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { CheckIcon } from "@phosphor-icons/react/Check";
import { Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { ReferenceManager } from "@/features/references/components/reference-manager.tsx";
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
      if (response.status === "completed") {
        setOperationId(response.draft.operationId);
      } else setOperationId(response.operationId);
    } catch {
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
    if (busy) {
      onOpenChange(false);
      return;
    }
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && requestClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="pr-8">Melhorar com IA</DialogTitle>
          <DialogDescription>
            Revise a sugestão antes de alterar o material original.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-6 lazuli-thin-scrollbar">
          {!draft ? (
            <div className="grid gap-6">
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-medium">Objetivo</legend>
                <div className="flex flex-wrap gap-2">
                  {availableIntents.map((value) => (
                    <Button
                      key={value}
                      onClick={() => setIntent(value)}
                      type="button"
                      variant={intent === value ? "default" : "outline"}
                    >
                      {intentLabels[value]}
                    </Button>
                  ))}
                </div>
              </fieldset>
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
              <div className="flex items-center justify-between gap-4 rounded-md bg-muted px-4 py-3 text-sm">
                <span className="flex items-center gap-2">
                  <CoinsIcon className="size-5 text-primary" weight="duotone" />
                  Custo: {AI_CREDITS_PER_ITEM} créditos
                </span>
                <span className="text-muted-foreground">
                  Saldo: {balance.data?.available ?? "…"}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid gap-7">
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="grid content-start gap-4 rounded-md border p-4">
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">Atual</p>
                  {draft.kind === "flashcard" ? (
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="current-question">Pergunta</Label>
                        <Textarea
                          id="current-question"
                          readOnly
                          value={richText(draft.current.question)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="current-answer">Resposta</Label>
                        <Textarea
                          id="current-answer"
                          readOnly
                          value={richText(draft.current.answer)}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-2">
                        <Label htmlFor="current-prompt">Pergunta</Label>
                        <Textarea
                          id="current-prompt"
                          readOnly
                          value={richText(draft.current.content)}
                        />
                      </div>
                      <QuizAlternativesField
                        onChange={() => undefined}
                        options={draft.current.options}
                        readOnly
                      />
                    </>
                  )}
                </section>
                <section className="grid gap-4 rounded-md border p-4">
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">
                    Sugestão editável
                  </p>
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
        </div>
        <DialogFooter className="mx-0 mb-0 border-t px-6 py-4">
          {draft ? (
            <>
              <Button
                className="text-destructive hover:text-destructive sm:mr-auto"
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
              <DialogCancelButton disabled={apply.isPending}>Fechar</DialogCancelButton>
              <Button
                disabled={busy || (balance.data?.available ?? 0) < AI_CREDITS_PER_ITEM}
                onClick={() => void generate()}
              >
                {busy ? <CircleNotchIcon className="animate-spin" /> : <MagicWandIcon />} Gerar
                proposta
              </Button>
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
