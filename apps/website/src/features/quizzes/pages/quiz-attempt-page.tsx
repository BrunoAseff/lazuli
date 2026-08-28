import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import type { QuizAttempt } from "@lazuli/shared";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  XCircleIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { releaseResolvedAssetUrls, resolveAssetUrl } from "@/features/assets/asset-api.ts";
import { lazuliBlockNoteDictionary } from "@/features/documents/editor/blocknote-dictionary.ts";
import {
  documentSchema,
  type LazuliDocumentBlock,
} from "@/features/documents/editor/document-schema.tsx";
import { cn } from "@/lib/utils.ts";
import { MaterialReferencesButton } from "@/features/references/components/material-references-dialog.tsx";
import {
  useAbandonQuizAttempt,
  useAnswerQuizAttempt,
  useCompleteQuizAttempt,
  useCreateQuizAttempt,
  useQuizAttempt,
} from "../api/quiz-queries.ts";
import { useQuizCollection } from "../api/quiz-collection-queries.ts";

export const QuizAttemptPage = () => {
  const { attemptId = "" } = useParams();
  const navigate = useNavigate();
  const attemptQuery = useQuizAttempt(attemptId);
  const answer = useAnswerQuizAttempt(attemptId);
  const complete = useCompleteQuizAttempt(attemptId);
  const abandon = useAbandonQuizAttempt(attemptId);
  const [index, setIndex] = useState(0);
  const [exitOpen, setExitOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const attempt = attemptQuery.data;
  useEffect(() => {
    if (attempt?.status === "active") {
      const first = attempt.items.findIndex(({ selectedOptionId }) => !selectedOptionId);
      if (first >= 0) setIndex(first);
    }
  }, [attempt?.id]);
  if (attemptQuery.isPending)
    return (
      <main className="grid min-h-full place-items-center">
        <LoaderCircleIcon className="animate-spin" />
      </main>
    );
  if (!attempt)
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-12">
        <h1 className="font-heading text-3xl">Tentativa não encontrada</h1>
        <Button asChild className="mt-5" variant="outline">
          <Link to="/quizzes">Voltar para quizzes</Link>
        </Button>
      </main>
    );
  if (attempt.status === "completed") return <QuizResult attempt={attempt} />;
  const item = attempt.items[index]!;
  const allAnswered = attempt.answeredQuestions === attempt.totalQuestions;
  const select = async (optionId: string) => {
    try {
      await answer.mutateAsync({ itemId: item.id, optionId });
    } catch {
      toast.error("Não foi possível salvar esta resposta.");
    }
  };
  const finish = async () => {
    try {
      await complete.mutateAsync();
    } catch {
      toast.error("Responda todas as questões antes de concluir.");
    }
  };
  return (
    <main className="flex min-h-full flex-col px-5 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto w-full max-w-4xl">
        <header className="border-b pb-5">
          <div className="flex items-center justify-between gap-4">
            <Button
              aria-label="Sair do quiz"
              onClick={() => setExitOpen(true)}
              size="icon"
              variant="ghost"
            >
              <ArrowLeftIcon />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-heading text-xl">{attempt.collectionTitle}</h1>
              <p className="text-xs text-muted-foreground">
                {attempt.answeredQuestions} de {attempt.totalQuestions} respondidas
              </p>
            </div>
            <span className="text-sm tabular-nums">
              {index + 1} / {attempt.totalQuestions}
            </span>
          </div>
          <Progress
            className="mt-4"
            value={(attempt.answeredQuestions / attempt.totalQuestions) * 100}
          />
          <div
            className="mt-3 flex gap-1 overflow-x-auto pb-1 lazuli-thin-scrollbar"
            aria-label="Navegação das questões"
          >
            {attempt.items.map((navigationItem, itemIndex) => (
              <button
                aria-label={`Questão ${itemIndex + 1}${navigationItem.selectedOptionId ? ", respondida" : ", pendente"}`}
                aria-current={itemIndex === index ? "step" : undefined}
                className={cn(
                  "size-7 shrink-0 border text-xs tabular-nums",
                  navigationItem.selectedOptionId && "bg-muted",
                  itemIndex === index && "border-foreground font-semibold",
                )}
                key={navigationItem.id}
                onClick={() => {
                  setIndex(itemIndex);
                  setReviewing(false);
                }}
                type="button"
              >
                {itemIndex + 1}
              </button>
            ))}
          </div>
        </header>
        {reviewing ? (
          <section className="py-8 sm:py-12">
            <h2 className="font-heading text-3xl">Revisar respostas</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Confira as questões antes de concluir. Respostas pendentes estão indicadas abaixo.
            </p>
            <div className="mt-7 divide-y border-y">
              {attempt.items.map((reviewItem, itemIndex) => {
                const selectedOption = reviewItem.options.find(
                  ({ id }) => id === reviewItem.selectedOptionId,
                );
                return (
                  <button
                    aria-label={`Ir para a questão ${itemIndex + 1}${reviewItem.selectedOptionId ? ", respondida" : ", pendente"}`}
                    className="flex w-full items-center gap-3 px-3 py-4 text-left transition-colors hover:bg-muted/60"
                    key={reviewItem.id}
                    onClick={() => {
                      setIndex(itemIndex);
                      setReviewing(false);
                    }}
                  >
                    {selectedOption ? (
                      <CheckCircle2Icon className="size-5 shrink-0" />
                    ) : (
                      <CircleIcon className="size-5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">Questão {itemIndex + 1}</span>
                      <span
                        className={cn(
                          "block truncate text-sm text-muted-foreground",
                          !selectedOption && "text-destructive",
                        )}
                      >
                        {selectedOption ? `Sua resposta: ${selectedOption.text}` : "Sem resposta"}
                      </span>
                    </span>
                    <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
            {!allAnswered && (
              <p className="mt-5 text-sm text-destructive">
                Ainda há {attempt.totalQuestions - attempt.answeredQuestions}{" "}
                {attempt.totalQuestions - attempt.answeredQuestions === 1
                  ? "questão pendente"
                  : "questões pendentes"}
                .
              </p>
            )}
          </section>
        ) : (
          <section className="py-8 sm:py-12">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Questão {index + 1}
            </p>
            <RichContent content={item.question} />
            <div className="mt-8 grid gap-3">
              {item.options.map((option) => (
                <button
                  aria-pressed={item.selectedOptionId === option.id}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 border px-4 py-3 text-left transition-colors hover:border-foreground/40",
                    item.selectedOptionId === option.id && "border-foreground bg-muted",
                  )}
                  disabled={answer.isPending}
                  key={option.id}
                  onClick={() => void select(option.id)}
                  type="button"
                >
                  {item.selectedOptionId === option.id ? (
                    <CheckCircle2Icon className="size-5 shrink-0" />
                  ) : (
                    <CircleIcon className="size-5 shrink-0 text-muted-foreground" />
                  )}
                  <span>{option.text}</span>
                </button>
              ))}
            </div>
          </section>
        )}
        <footer className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          {reviewing ? (
            <Button onClick={() => setReviewing(false)} variant="outline">
              <ArrowLeftIcon /> Voltar à questão
            </Button>
          ) : (
            <div className="ml-auto flex gap-2">
              <Button
                disabled={index === 0}
                onClick={() => setIndex((value) => value - 1)}
                variant="outline"
              >
                <ArrowLeftIcon /> Anterior
              </Button>
              {index === attempt.items.length - 1 ? (
                <Button onClick={() => setReviewing(true)}>Revisar respostas</Button>
              ) : (
                <Button onClick={() => setIndex((value) => value + 1)}>
                  Próxima <ArrowRightIcon />
                </Button>
              )}
            </div>
          )}
          {reviewing ? (
            <Button disabled={!allAnswered || complete.isPending} onClick={() => void finish()}>
              {complete.isPending && <LoaderCircleIcon className="animate-spin" />} Concluir quiz
            </Button>
          ) : null}
        </footer>
      </div>
      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da tentativa?</AlertDialogTitle>
            <AlertDialogDescription>
              Suas respostas estão salvas. Você pode continuar depois ou abandonar esta tentativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-wrap">
            <AlertDialogCancel>Continuar respondendo</AlertDialogCancel>
            <Button
              onClick={() => void navigate(`/quizzes/${attempt.collectionId}`)}
              variant="outline"
            >
              Sair e continuar depois
            </Button>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                await abandon.mutateAsync();
                await navigate(`/quizzes/${attempt.collectionId}`);
              }}
            >
              Abandonar tentativa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};

const RichContent = ({ content }: { content: unknown[] }) => {
  const editor = useCreateBlockNote(
    {
      schema: documentSchema,
      initialContent: content as LazuliDocumentBlock,
      dictionary: lazuliBlockNoteDictionary,
      resolveFileUrl: resolveAssetUrl,
    },
    [content],
  );
  useEffect(() => () => releaseResolvedAssetUrls(), []);
  return (
    <BlockNoteView
      className="lazuli-editor lazuli-readonly-editor"
      editable={false}
      editor={editor}
      sideMenu={false}
      slashMenu={false}
      theme="light"
    />
  );
};

const QuizResult = ({ attempt }: { attempt: Extract<QuizAttempt, { status: "completed" }> }) => {
  const navigate = useNavigate();
  const restart = useCreateQuizAttempt(attempt.collectionId);
  const collection = useQuizCollection(attempt.collectionId);
  const [params, setParams] = useSearchParams();
  const requestedQuestion = params.get("question");
  const requestedIndex = attempt.items.findIndex(
    ({ questionId }) => questionId === requestedQuestion,
  );
  const reviewIndex = requestedIndex >= 0 ? requestedIndex : 0;
  const item = attempt.items[reviewIndex]!;
  useEffect(() => {
    if (requestedIndex >= 0) return;
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        updated.set("question", item.questionId);
        return updated;
      },
      { replace: true },
    );
  }, [item.questionId, requestedIndex, setParams]);
  const selectQuestion = (index: number) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        updated.set("question", attempt.items[index]!.questionId);
        updated.delete("reference");
        return updated;
      },
      { replace: true },
    );
  const rate = Math.round((attempt.correctAnswers / attempt.totalQuestions) * 100);
  const durationMinutes = Math.max(
    1,
    Math.round(
      (new Date(attempt.completedAt!).getTime() - new Date(attempt.startedAt).getTime()) / 60_000,
    ),
  );
  return (
    <main className="flex min-h-full flex-col px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="border-b pb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Resultado
          </p>
          <h1 className="mt-2 font-heading text-4xl">{rate}%</h1>
          <p className="mt-2 text-muted-foreground">
            {attempt.correctAnswers} de {attempt.totalQuestions} respostas corretas
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Concluído em cerca de {durationMinutes} {durationMinutes === 1 ? "minuto" : "minutos"}
            {collection.data?.bestScoreRate !== null && collection.data?.bestScoreRate !== undefined
              ? ` · Melhor pontuação da coleção: ${Math.round(collection.data.bestScoreRate * 100)}%`
              : ""}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button
              onClick={async () => {
                const next = await restart.mutateAsync({
                  id: crypto.randomUUID(),
                  abandonActive: false,
                });
                await navigate(`/quizzes/${attempt.collectionId}/attempts/${next.id}`);
              }}
            >
              <RotateCcwIcon /> Tentar novamente
            </Button>
            <Button asChild variant="outline">
              <Link to={`/quizzes/${attempt.collectionId}`}>Voltar à coleção</Link>
            </Button>
          </div>
        </header>
        <section className="py-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-heading text-2xl">Revisão</h2>
            <span className="text-sm text-muted-foreground">
              {reviewIndex + 1} de {attempt.totalQuestions}
            </span>
          </div>
          <RichContent content={item.question} />
          <div className="mt-6 grid gap-3">
            {item.options.map((option) => {
              const correct = option.id === item.correctOptionId;
              const selected = option.id === item.selectedOptionId;
              return (
                <div
                  className={cn(
                    "flex items-center gap-3 border px-4 py-3",
                    correct && "border-emerald-700 bg-emerald-50",
                    selected && !correct && "border-destructive bg-destructive/5",
                  )}
                  key={option.id}
                >
                  {correct ? (
                    <CheckCircle2Icon className="size-5 text-emerald-700" />
                  ) : selected ? (
                    <XCircleIcon className="size-5 text-destructive" />
                  ) : (
                    <CircleIcon className="size-5 text-muted-foreground" />
                  )}
                  <span>{option.text}</span>
                  {(correct || selected) && (
                    <span
                      className={cn(
                        "ml-auto text-xs font-medium",
                        correct ? "text-emerald-800" : "text-destructive",
                      )}
                    >
                      {selected && correct
                        ? "Sua resposta · correta"
                        : selected
                          ? "Sua resposta"
                          : "Resposta correta"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-5">
            <MaterialReferencesButton
              count={item.referenceCount}
              target={{ id: item.questionId, type: "quizQuestion" }}
            />
          </div>
          <div className="mt-6 flex justify-between">
            <Button
              disabled={reviewIndex === 0}
              onClick={() => selectQuestion(reviewIndex - 1)}
              variant="outline"
            >
              <ArrowLeftIcon /> Anterior
            </Button>
            <Button
              disabled={reviewIndex === attempt.items.length - 1}
              onClick={() => selectQuestion(reviewIndex + 1)}
              variant="outline"
            >
              Próxima <ArrowRightIcon />
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
};
export default QuizAttemptPage;
