import { isNotFound, ResourceUnavailable } from "@/components/not-found-page.tsx";
import { Trash2Icon } from "@/components/icons.tsx";
import { useCreateBlockNote } from "@blocknote/react";
import { BackButton, BackLink } from "@/components/nav-link.tsx";
import { ThemedBlockNoteView as BlockNoteView } from "@/components/themed-blocknote-view.tsx";
import { collectDocumentTextBlocks, type DocumentBlock, type QuizAttempt } from "@lazuli/shared";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
} from "@/components/icons.tsx";
import { useEffect, useState, Fragment } from "react";
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
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { motionTokens } from "@/components/arc/motion-tokens.ts";
import { AutoHeight } from "@/components/auto-height.tsx";
import { StudySessionProgress } from "@/components/study-session-progress.tsx";
import { ResultDistribution } from "@/components/result-distribution.tsx";
import { StudyAnswerChoice, StudyAnswerOutcome } from "@/components/study-answer-choice.tsx";
import "@/components/study-practice.css";
import { releaseResolvedAssetUrls, resolveAssetUrl } from "@/features/assets/asset-api.ts";
import { lazuliBlockNoteDictionary } from "@/features/documents/editor/blocknote-dictionary.ts";
import {
  documentSchema,
  type LazuliDocumentBlock,
} from "@/features/documents/editor/document-schema.tsx";
import { MaterialReferencesButton } from "@/features/references/components/material-references-dialog.tsx";
import {
  useAbandonQuizAttempt,
  useAnswerQuizAttempt,
  useCompleteQuizAttempt,
  useCreateQuizAttempt,
  useQuizAttempt,
} from "../api/quiz-queries.ts";
import { useQuizCollection } from "../api/quiz-collection-queries.ts";
import {
  StoneContributionRow,
  StoneLevelUp,
} from "@/features/stone/components/stone-contribution.tsx";

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

const questionPreview = (content: unknown[]) =>
  collectDocumentTextBlocks(content as DocumentBlock[])
    .map(({ text }) => text)
    .join(" ");

export const QuizAttemptPage = () => {
  const { attemptId = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestedQuestion = params.get("question");
  const attemptQuery = useQuizAttempt(attemptId);
  const answer = useAnswerQuizAttempt(attemptId);
  const complete = useCompleteQuizAttempt(attemptId);
  const abandon = useAbandonQuizAttempt(attemptId);
  const [index, setIndex] = useState(0);
  const [exitOpen, setExitOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [direction, setDirection] = useState(1);
  const reduced = useReducedMotion();
  const attempt = attemptQuery.data;
  useEffect(() => {
    if (attempt?.status === "active") {
      const requestedIndex = attempt.items.findIndex(
        ({ questionId }) => questionId === requestedQuestion,
      );
      if (requestedIndex >= 0) {
        setIndex(requestedIndex);
        return;
      }
      const first = attempt.items.findIndex(({ selectedOptionId }) => !selectedOptionId);
      if (first >= 0) setIndex(first);
    }
  }, [attempt?.id]);
  const activeItem = attempt?.status === "active" ? attempt.items[index] : undefined;
  useEffect(() => {
    if (!activeItem) return;
    const requestedExists = attempt?.items.some(
      ({ questionId }) => questionId === requestedQuestion,
    );
    if (requestedExists && requestedQuestion !== activeItem.questionId) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("question", activeItem.questionId);
        return next;
      },
      { replace: true },
    );
  }, [activeItem?.questionId, attempt?.id, requestedQuestion, setParams]);
  if (attemptQuery.isPending)
    return (
      <main className="grid min-h-full place-items-center">
        <LoaderCircleIcon className="animate-spin" />
      </main>
    );
  if (!attempt)
    return (
      <ResourceUnavailable
        backLabel="Voltar aos quizzes"
        backTo="/quizzes"
        notFound={isNotFound(attemptQuery.error) || !attemptQuery.isError}
        onRetry={() => void attemptQuery.refetch()}
        title="Tentativa não encontrada"
      />
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
  const goTo = (next: number) => {
    setDirection(next >= index ? 1 : -1);
    setIndex(next);
    setReviewing(false);
  };
  const pending = attempt.totalQuestions - attempt.answeredQuestions;
  return (
    <main className="practice">
      <header className="practice-head">
        <BackButton
          aria-label={`Sair do quiz ${attempt.collectionTitle}`}
          onClick={() => setExitOpen(true)}
        >
          {attempt.collectionTitle}
        </BackButton>
        <p className="practice-count">
          <span className="text-foreground">{attempt.answeredQuestions}</span> de{" "}
          {attempt.totalQuestions} respondidas
        </p>
      </header>
      <div className="practice-progress">
        <StudySessionProgress
          completed={attempt.answeredQuestions}
          label={`${attempt.answeredQuestions} de ${attempt.totalQuestions} questões respondidas`}
          total={attempt.totalQuestions}
        />
      </div>
      <AnimatePresence custom={direction} initial={false} mode="wait">
        {reviewing ? (
          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="practice-stage practice-sheet"
            exit={{ opacity: 0 }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 20 }}
            key="review"
            transition={{ duration: 0.18, ease: motionTokens.ease.standard }}
          >
            <p className="practice-kicker">Antes de concluir</p>
            <h2 className="font-heading text-lg font-semibold">Revisar respostas</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {pending
                ? `Ainda ${pending === 1 ? "há 1 questão pendente" : `há ${pending} questões pendentes`}. Abra uma questão para responder.`
                : "Todas as questões foram respondidas. Abra uma questão para mudar a resposta."}
            </p>
            <ol className="mt-7 grid gap-1">
              {attempt.items.map((reviewItem, itemIndex) => {
                const selectedOption = reviewItem.options.find(
                  ({ id }) => id === reviewItem.selectedOptionId,
                );
                return (
                  <li key={reviewItem.id}>
                    <button
                      aria-label={`Ir para a questão ${itemIndex + 1}${
                        selectedOption ? ", respondida" : ", pendente"
                      }`}
                      className="practice-review-row"
                      data-pending={selectedOption ? undefined : ""}
                      onClick={() => goTo(itemIndex)}
                      type="button"
                    >
                      <span className="practice-review-number">{itemIndex + 1}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm">
                          {questionPreview(reviewItem.question) || `Questão ${itemIndex + 1}`}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {selectedOption ? selectedOption.text : "Sem resposta"}
                        </span>
                      </span>
                      <ArrowRightIcon aria-hidden="true" className="size-4 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="practice-footer">
              <Button onClick={() => setReviewing(false)} variant="outline">
                <ArrowLeftIcon /> Voltar à questão
              </Button>
              <Button
                pending={complete.isPending}
                disabled={!allAnswered || complete.isPending}
                onClick={() => void finish()}
              >
                Concluir quiz
              </Button>
            </div>
          </motion.section>
        ) : (
          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="practice-stage practice-sheet"
            custom={direction}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -20 * direction }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 20 * direction }}
            key={item.id}
            transition={{ duration: 0.18, ease: motionTokens.ease.standard }}
          >
            <p className="practice-kicker">Questão {index + 1}</p>
            <div className="practice-question">
              <RichContent content={item.question} />
            </div>
            <div className="choices" role="group" aria-label="Alternativas">
              {item.options.map((option, optionIndex) => (
                <StudyAnswerChoice
                  text={option.text}
                  index={optionIndex}
                  selected={item.selectedOptionId === option.id}
                  key={option.id}
                  onSelect={() => void select(option.id)}
                />
              ))}
            </div>
            <div className="practice-footer">
              <Button disabled={index === 0} onClick={() => goTo(index - 1)} variant="ghost">
                <ArrowLeftIcon /> Anterior
              </Button>
              {index === attempt.items.length - 1 ? (
                <Button onClick={() => setReviewing(true)}>
                  Revisar respostas <ArrowRightIcon />
                </Button>
              ) : (
                <Button
                  onClick={() => goTo(index + 1)}
                  variant={item.selectedOptionId ? "default" : "outline"}
                >
                  Próxima <ArrowRightIcon />
                </Button>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da tentativa?</AlertDialogTitle>
            <AlertDialogDescription>
              Suas respostas estão salvas. Você pode continuar depois ou abandonar esta tentativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* Destructive choice apart on the left; leaving keeps the answers, so it is the main way out. */}
          <AlertDialogFooter>
            <AlertDialogAction
              className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
              variant="ghost"
              onClick={async () => {
                await abandon.mutateAsync();
                await navigate(`/quizzes/${attempt.collectionId}`);
              }}
            >
              <Trash2Icon aria-hidden="true" /> Abandonar
            </AlertDialogAction>
            <AlertDialogCancel>Continuar respondendo</AlertDialogCancel>
            <Button onClick={() => void navigate(`/quizzes/${attempt.collectionId}`)}>Sair</Button>
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
      domAttributes: { editor: { role: "document" } },
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
    />
  );
};

const QuizResult = ({ attempt }: { attempt: Extract<QuizAttempt, { status: "completed" }> }) => {
  const navigate = useNavigate();
  const restart = useCreateQuizAttempt(attempt.collectionId);
  const collection = useQuizCollection(attempt.collectionId);
  const [params, setParams] = useSearchParams();
  const requestedQuestion = params.get("question");
  const requestedIndex = attempt.items.findIndex(({ id, questionId }) =>
    params.get("item")
      ? id === params.get("item")
      : Boolean(requestedQuestion) && questionId === requestedQuestion,
  );
  // Reviewing is about mistakes: open the first wrong answer unless a link asked for another one.
  // "none" keeps everything closed after the learner collapses the open question.
  const firstIncorrect = attempt.items.findIndex(({ isCorrect }) => !isCorrect);
  const openIndex =
    params.get("item") === "none" ? -1 : requestedIndex >= 0 ? requestedIndex : firstIncorrect;
  const toggleQuestion = (index: number) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        updated.delete("reference");
        if (index === openIndex) {
          updated.set("item", "none");
          updated.delete("question");
          return updated;
        }
        updated.set("item", attempt.items[index]!.id);
        const questionId = attempt.items[index]!.questionId;
        if (questionId) updated.set("question", questionId);
        else updated.delete("question");
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
    <main className="practice">
      <header className="practice-head">
        <BackLink to={`/quizzes/${attempt.collectionId}`}>{attempt.collectionTitle}</BackLink>
      </header>
      <section
        className="practice-stage practice-sheet result-summary"
        aria-labelledby="quiz-result-title"
      >
        <StoneLevelUp id={attempt.id} kind="quiz" />
        <div className="result-head">
          <div>
            <p className="practice-kicker">Resultado da tentativa</p>
            <h1 className="page-title" id="quiz-result-title">
              {attempt.correctAnswers} de {attempt.totalQuestions}{" "}
              {attempt.totalQuestions === 1 ? "acerto" : "acertos"}
            </h1>
            {/* Each fact stays whole when the line wraps. */}
            <p className="result-subtitle">
              {[
                `${rate}% de aproveitamento`,
                collection.data?.bestScoreRate !== null &&
                collection.data?.bestScoreRate !== undefined
                  ? `melhor da coleção ${Math.round(collection.data.bestScoreRate * 100)}%`
                  : null,
                formatDuration(durationMinutes),
              ]
                .filter(Boolean)
                .map((fact, index) => (
                  // The separator stays outside, so the line can break between facts only.
                  <Fragment key={index}>
                    {index > 0 && " · "}
                    <span className="whitespace-nowrap">{fact}</span>
                  </Fragment>
                ))}
            </p>
          </div>
          <div className="practice-actions">
            <Button asChild variant="outline">
              <Link to={`/quizzes/${attempt.collectionId}`}>Voltar à coleção</Link>
            </Button>
            <Button
              pending={restart.isPending}
              pendingLabel="Iniciando"
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
          </div>
        </div>
        <ResultDistribution
          label="Respostas"
          parts={[
            { count: attempt.correctAnswers, label: "Corretas", tone: "correct" },
            {
              count: attempt.totalQuestions - attempt.correctAnswers,
              label: "Erradas",
              tone: "incorrect",
            },
          ]}
        />
        <StoneContributionRow id={attempt.id} kind="quiz" />
      </section>
      <section className="practice-stage practice-sheet" aria-labelledby="quiz-review-title">
        <header className="practice-section-head">
          <h2 id="quiz-review-title">Revisão das respostas</h2>
          <span>
            {attempt.totalQuestions - attempt.correctAnswers}{" "}
            {attempt.totalQuestions - attempt.correctAnswers === 1 ? "erro" : "erros"}
          </span>
        </header>
        <ol className="result-list">
          {attempt.items.map((reviewItem, itemIndex) => {
            const open = itemIndex === openIndex;
            return (
              <li className="result-item" data-open={open || undefined} key={reviewItem.id}>
                <button
                  aria-expanded={open}
                  className="result-row"
                  onClick={() => toggleQuestion(itemIndex)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="result-badge"
                    data-outcome={reviewItem.isCorrect ? "correct" : "incorrect"}
                  >
                    {itemIndex + 1}
                  </span>
                  <span className="result-row-text">
                    <span className="sr-only">
                      Questão {itemIndex + 1}, {reviewItem.isCorrect ? "correta" : "incorreta"}
                      :{" "}
                    </span>
                    {questionPreview(reviewItem.question) || `Questão ${itemIndex + 1}`}
                  </span>
                  <ChevronDownIcon aria-hidden="true" className="result-row-chevron" />
                </button>
                <AutoHeight>
                  {open && (
                    <div className="result-detail">
                      <div className="choices mt-0">
                        {reviewItem.options.map((option, optionIndex) => (
                          <StudyAnswerOutcome
                            correct={option.id === reviewItem.correctOptionId}
                            index={optionIndex}
                            key={option.id}
                            selected={option.id === reviewItem.selectedOptionId}
                            text={option.text}
                          />
                        ))}
                      </div>
                      {reviewItem.questionId && (
                        <div className="mt-4">
                          <MaterialReferencesButton
                            count={reviewItem.referenceCount}
                            target={{ id: reviewItem.questionId, type: "quizQuestion" }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </AutoHeight>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
};
export default QuizAttemptPage;
