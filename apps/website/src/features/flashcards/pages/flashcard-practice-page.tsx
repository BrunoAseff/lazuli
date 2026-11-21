import { Spinner } from "@/components/ui/spinner.tsx";
import { isNotFound, ResourceUnavailable } from "@/components/not-found-page.tsx";
import { useCreateBlockNote } from "@blocknote/react";
import { BackLink } from "@/components/nav-link.tsx";
import { ThemedBlockNoteView as BlockNoteView } from "@/components/themed-blocknote-view.tsx";
import type { FlashcardPracticeSession, FlashcardRating } from "@lazuli/shared";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button.tsx";
import { Kbd } from "@/components/ui/kbd.tsx";
import "@/components/study-practice.css";
import { StudyReveal } from "@/components/study-reveal.tsx";
import { goldBurst } from "@/components/motion/gold-burst.ts";
import { ResultDistribution } from "@/components/result-distribution.tsx";
import { StudySessionProgress } from "@/components/study-session-progress.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import { releaseResolvedAssetUrls, resolveAssetUrl } from "@/features/assets/asset-api.ts";
import { lazuliBlockNoteDictionary } from "@/features/documents/editor/blocknote-dictionary.ts";
import {
  documentSchema,
  type LazuliDocumentBlock,
} from "@/features/documents/editor/document-schema.tsx";
import { formatUpcoming } from "@/lib/date-format.ts";
import { MaterialReferencesButton } from "@/features/references/components/material-references-dialog.tsx";
import {
  practicePaths,
  usePracticeAvailability,
  type PracticeTarget,
  useFlashcardCollection,
  usePracticeSession,
  useSubmitPracticeReview,
} from "../api/flashcard-queries.ts";
import { getFlashcardCollectionErrorMessage } from "../flashcard-messages.ts";
import { PracticeSetupDialog } from "../components/practice-setup-dialog.tsx";
import {
  StoneContributionRow,
  StoneLevelUp,
} from "@/features/stone/components/stone-contribution.tsx";
import { ease } from "@/lib/motion.ts";

const ratings: Array<{
  value: FlashcardRating;
  label: string;
  help: string;
  key: string;
}> = [
  { value: "again", label: "Repetir", help: "Não lembrei", key: "1" },
  { value: "hard", label: "Difícil", help: "Lembrei com bastante esforço", key: "2" },
  { value: "good", label: "Bom", help: "Lembrei com esforço normal", key: "3" },
  { value: "easy", label: "Fácil", help: "Lembrei imediatamente", key: "4" },
];

const formatInterval = (seconds: number) => {
  if (seconds < 60) return "agora";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} mês${months === 1 ? "" : "es"}`;
  const years = Math.round(days / 365);
  return `${years} ano${years === 1 ? "" : "s"}`;
};

/**
 * Where the card goes once rated: "Repetir" slides back the way it came (it will return),
 * the others move on, and "Fácil" lifts away, set aside as known.
 */
const cardExit = (rating: FlashcardRating | null) =>
  rating === "again"
    ? { opacity: 0, x: 24 }
    : rating === "easy"
      ? { opacity: 0, y: -14, scale: 0.98 }
      : { opacity: 0, x: -20 };

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export default function FlashcardPracticePage() {
  const { collectionId = "", projectId, sessionId = "" } = useParams();
  // The same practice runs over one collection or over a whole project's flashcards.
  const target: PracticeTarget = projectId
    ? { type: "project", id: projectId }
    : { type: "collection", id: collectionId };
  const home = practicePaths(target).home;
  const homeLabel = target.type === "project" ? "Voltar ao projeto" : "Voltar à coleção";
  const practice = usePracticeSession(sessionId);
  const submit = useSubmitPracticeReview(sessionId, target);
  const [revealed, setRevealed] = useState(false);
  const [animateReveal, setAnimateReveal] = useState(false);
  const [failedRating, setFailedRating] = useState<FlashcardRating | null>(null);
  // The rating in flight (kept lit), the key just pressed (shown as a press), and the last rating
  // recorded, which decides where the card leaves to.
  const [chosen, setChosen] = useState<FlashcardRating | null>(null);
  const [pressed, setPressed] = useState<FlashcardRating | null>(null);
  const lastRating = useRef<FlashcardRating | null>(null);
  const questionRegion = useRef<HTMLElement>(null);
  const reviewAttempt = useRef<{
    itemId: string;
    rating: FlashcardRating;
    reviewId: string;
  } | null>(null);
  const itemId = practice.data?.currentItem?.id;
  const reduced = useReducedMotion();

  useEffect(() => {
    setRevealed(false);
    setFailedRating(null);
    setChosen(null);
    reviewAttempt.current = null;
    questionRegion.current?.focus({ preventScroll: true });
  }, [itemId]);
  useEffect(() => () => releaseResolvedAssetUrls(), []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || submit.isPending || !practice.data?.currentItem) return;
      if (event.code === "Space" && !revealed) {
        event.preventDefault();
        setAnimateReveal(false);
        setRevealed(true);
        return;
      }
      if (revealed && ["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        const rating = ratings[Number(event.key) - 1];
        if (rating && (!failedRating || failedRating === rating.value)) {
          setPressed(rating.value);
          window.setTimeout(() => setPressed(null), 140);
          void review(rating.value);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [failedRating, practice.data?.currentItem, revealed, submit.isPending]);

  const review = async (rating: FlashcardRating) => {
    if (!itemId) return;
    const attempt =
      reviewAttempt.current?.itemId === itemId
        ? reviewAttempt.current
        : { itemId, rating, reviewId: crypto.randomUUID() };
    reviewAttempt.current = attempt;
    setChosen(attempt.rating);
    try {
      await submit.mutateAsync({
        id: attempt.reviewId,
        itemId: attempt.itemId,
        rating: attempt.rating,
      });
      // Remembered "easily": a few pyrite flecks rise from the choice before the card leaves.
      if (attempt.rating === "easy") {
        const origin = document.querySelector('.practice-rating[data-rating="easy"]');
        if (origin) goldBurst(origin);
      }
      lastRating.current = attempt.rating;
      reviewAttempt.current = null;
      setFailedRating(null);
      setChosen(null);
      setRevealed(false);
    } catch (error) {
      setChosen(null);
      setFailedRating(attempt.rating);
      toast.error(
        getFlashcardCollectionErrorMessage(error, "Não foi possível registrar sua resposta."),
      );
    }
  };

  if (practice.isPending)
    return (
      <main className="flex min-h-[70vh] items-center justify-center">
        <Spinner aria-hidden="true" role="presentation" className="size-6" />
      </main>
    );
  if (practice.isError || !practice.data)
    return (
      <ResourceUnavailable
        backLabel={homeLabel}
        backTo={home}
        notFound={isNotFound(practice.error) || !practice.isError}
        onRetry={() => void practice.refetch()}
        title="Prática não encontrada"
      />
    );

  const session = practice.data;
  if (session.status !== "active" || !session.currentItem)
    return <PracticeSummary session={session} target={target} />;

  const item = session.currentItem;
  return (
    <main className="practice">
      <header className="practice-head">
        <BackLink to={home}>{session.collectionTitle}</BackLink>
        <p className="practice-count">
          <span className="text-foreground">{session.reviewedCards}</span> de {session.totalCards}
        </p>
      </header>
      <StudySessionProgress
        label={`${session.reviewedCards} de ${session.totalCards} flashcards revisados`}
        className="practice-progress"
        completed={session.reviewedCards}
        total={session.totalCards}
      />
      <AnimatePresence custom={lastRating.current} initial={false} mode="wait">
        <motion.article
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          className="practice-stage practice-sheet"
          custom={lastRating.current}
          exit={reduced ? { opacity: 0 } : "leave"}
          variants={{ leave: cardExit }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: 20 }}
          key={item.id}
          transition={{ duration: 0.18, ease: ease.standard }}
        >
          <section
            ref={questionRegion}
            tabIndex={-1}
            className="outline-none"
            aria-labelledby="question-title"
          >
            <p className="practice-kicker" id="question-title">
              Pergunta
            </p>
            <div className="practice-question">
              <RichContent content={item.card.question as LazuliDocumentBlock} />
            </div>
          </section>
          {!revealed ? (
            <div className="practice-reveal">
              <Button
                onClick={(event) => {
                  setAnimateReveal(event.detail > 0);
                  setRevealed(true);
                }}
                size="lg"
              >
                Mostrar resposta
                <Kbd>Espaço</Kbd>
              </Button>
            </div>
          ) : (
            <StudyReveal animated={animateReveal} label="Resposta do flashcard">
              <section className="practice-answer" aria-labelledby="answer-title">
                <p className="practice-kicker" id="answer-title">
                  Resposta
                </p>
                <RichContent content={item.card.answer as LazuliDocumentBlock} />
              </section>
              <div className="practice-scale-label">
                <span id="rating-title">Como foi lembrar?</span>
                <span>Próxima revisão</span>
              </div>
              <TooltipProvider delayDuration={400}>
                <div aria-labelledby="rating-title" className="practice-scale" role="group">
                  {ratings.map((rating) => {
                    const preview = item.intervals.find(
                      ({ rating: value }) => value === rating.value,
                    );
                    return (
                      <Tooltip key={rating.value}>
                        <TooltipTrigger asChild>
                          <button
                            className="practice-rating"
                            data-chosen={chosen === rating.value || undefined}
                            data-pressed={pressed === rating.value || undefined}
                            data-rating={rating.value}
                            disabled={
                              submit.isPending ||
                              (failedRating !== null && failedRating !== rating.value)
                            }
                            onClick={() => void review(rating.value)}
                            type="button"
                          >
                            <span className="practice-rating-label">
                              {failedRating === rating.value ? "Tentar novamente" : rating.label}
                              <Kbd>{rating.key}</Kbd>
                            </span>
                            <span className="practice-rating-interval">
                              {preview ? formatInterval(preview.intervalSeconds) : "—"}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>{rating.help}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
            </StudyReveal>
          )}
        </motion.article>
      </AnimatePresence>
    </main>
  );
}

const RichContent = ({ content }: { content: LazuliDocumentBlock }) => {
  const editor = useCreateBlockNote(
    {
      schema: documentSchema,
      initialContent: content,
      domAttributes: { editor: { role: "document" } },
      dictionary: lazuliBlockNoteDictionary,
      resolveFileUrl: resolveAssetUrl,
    },
    [content],
  );
  return (
    <BlockNoteView
      className="lazuli-editor lazuli-flashcard-practice"
      editable={false}
      editor={editor}
    />
  );
};

const PracticeSummary = ({
  session,
  target,
}: {
  session: FlashcardPracticeSession;
  target: PracticeTarget;
}) => {
  const availability = usePracticeAvailability(target);
  const isCollection = target.type === "collection";
  const collection = useFlashcardCollection(target.id, isCollection);
  const home = practicePaths(target).home;
  const left = availability.data?.totalAvailable ?? 0;
  const [setupOpen, setSetupOpen] = useState(false);
  const correct = session.ratings.hard + session.ratings.good + session.ratings.easy;
  const completed = session.status === "completed";
  return (
    <main className="practice">
      <header className="practice-head">
        <BackLink to={home}>{session.collectionTitle}</BackLink>
      </header>
      <section
        className="practice-stage practice-sheet result-summary"
        aria-labelledby="practice-summary-title"
      >
        <StoneLevelUp id={session.id} kind="flashcards" />
        <div className="result-head">
          <div>
            <p className="practice-kicker">{completed ? "Sessão concluída" : "Sessão encerrada"}</p>
            <h1 className="page-title" id="practice-summary-title">
              {session.reviewedCards}{" "}
              {session.reviewedCards === 1 ? "flashcard revisado" : "flashcards revisados"}
            </h1>
            <p className="result-subtitle">
              {correct} {correct === 1 ? "lembrado" : "lembrados"} ·{" "}
              {!isCollection
                ? left
                  ? `${left} ainda ${left === 1 ? "disponível" : "disponíveis"} no projeto`
                  : "nada pendente no projeto"
                : collection.data?.dueCards
                  ? `${collection.data.dueCards} ainda ${collection.data.dueCards === 1 ? "disponível" : "disponíveis"}`
                  : collection.data?.nextPracticeAt
                    ? `próxima revisão ${formatUpcoming(collection.data.nextPracticeAt)}`
                    : "nenhuma revisão agendada"}
            </p>
          </div>
          <div className="practice-actions">
            {/* With nothing waiting, going back is the way forward, not a disabled button. */}
            <Button asChild variant={availability.data?.totalAvailable ? "outline" : "default"}>
              <Link to={home}>{isCollection ? "Voltar à coleção" : "Voltar ao projeto"}</Link>
            </Button>
            {availability.data?.totalAvailable ? (
              <Button onClick={() => setSetupOpen(true)}>Praticar mais</Button>
            ) : null}
          </div>
        </div>
        <ResultDistribution
          label="Como foi lembrar"
          parts={ratings.map((rating) => ({
            count: session.ratings[rating.value],
            label: rating.label,
            tone: rating.value,
          }))}
        />
        <StoneContributionRow id={session.id} kind="flashcards" />
      </section>
      {session.reviewedMaterials.some(({ referenceCount }) => referenceCount > 0) && (
        <section className="practice-stage practice-sheet" aria-labelledby="practice-sources-title">
          <header className="practice-section-head">
            <h2 id="practice-sources-title">Fontes dos flashcards revisados</h2>
          </header>
          <ul className="mt-3 grid gap-1">
            {session.reviewedMaterials
              .filter(({ referenceCount }) => referenceCount > 0)
              .map((card) => (
                <li className="flex min-w-0 items-center gap-4 py-2" key={card.id}>
                  <p className="min-w-0 flex-1 truncate text-sm">
                    {card.questionText || "Flashcard com imagem"}
                  </p>
                  <MaterialReferencesButton
                    count={card.referenceCount}
                    target={{ id: card.id, type: "flashcard" }}
                  />
                </li>
              ))}
          </ul>
        </section>
      )}
      {isCollection ? (
        <PracticeSetupDialog
          collectionId={target.id}
          onOpenChange={setSetupOpen}
          open={setupOpen}
        />
      ) : (
        <PracticeSetupDialog onOpenChange={setSetupOpen} open={setupOpen} projectId={target.id} />
      )}
    </main>
  );
};
