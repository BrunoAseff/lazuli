import type { StoneDay, StoneResponse } from "@lazuli/shared";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useReducer, useRef, useState } from "react";

import { AutoHeight } from "@/components/auto-height.tsx";
import { CheckIcon } from "@/components/icons.tsx";
import { DocumentDomainIcon, ProjectOpenIcon } from "@/components/domain-icons.ts";
import { Kbd } from "@/components/ui/kbd.tsx";
import { MorphText } from "@/components/motion/morph-text.tsx";
import { goldBurst } from "@/components/motion/gold-burst.ts";
import { StudyAnswerChoice, StudyAnswerOutcome } from "@/components/study-answer-choice.tsx";
import { StudyReveal } from "@/components/study-reveal.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { StoneCardView } from "@/features/stone/components/stone-card.tsx";
import { GenerationPending } from "@/features/ai/components/generation-pending.tsx";
import { cn } from "@/lib/utils.ts";
import "@/components/study-practice.css";

import {
  practiceFlashcards,
  practiceQuizQuestions,
  practiceRatings,
  practiceSources,
} from "./practice-content.ts";
import {
  createFlashcardState,
  createQuizState,
  flashcardReducer,
  quizReducer,
} from "./practice-state.ts";
import { ease } from "@/lib/motion.ts";

/** Example days for the stone: dates only matter for their weekday names. */
/** An example stone: Facetada, a good week, today's goal half done. */
const exampleWeek = [
  ["2026-11-13", 2, "met"],
  ["2026-11-14", 0, "missed"],
  ["2026-11-15", 3, "met"],
  ["2026-11-16", 2, "met"],
  ["2026-11-17", 0, "off"],
  ["2026-11-18", 2, "met"],
  ["2026-11-19", 1, "open"],
].map(([date, practices, status]) => ({
  date: date as string,
  practices: practices as number,
  status: status as StoneDay["status"],
  studyDay: status !== "off",
}));
const exampleStone: StoneResponse = {
  level: 3,
  mastered: 62,
  notMastered: 40,
  paused: false,
  dull: 0,
  keptDays: 4,
  plannedDays: 5,
  goal: { counts: "both", practices: 2, days: [true, true, true, true, true, false, true] },
  today: exampleWeek.at(-1)!,
  week: exampleWeek,
  history: exampleWeek,
  levels: [],
  projects: [],
};

/** Next review after each rating, as the app shows it for a card seen for the first time. */
const exampleIntervals = { again: "1 min", hard: "6 min", good: "10 min", easy: "4 d" } as const;

/** Gather: a project with its documents and the passage being studied. */
export const MaterialsDemo = () => (
  <div className="surface-panel grid overflow-hidden sm:grid-cols-[13rem_1fr]">
    <aside className="hidden border-r border-[var(--line-subtle)] p-3 sm:block">
      <p className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium">
        <ProjectOpenIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        Física: luz e cor
      </p>
      <ul className="mt-1 grid gap-0.5 text-sm">
        {practiceSources.map((source, index) => (
          <li
            key={source.id}
            className={cn(
              "flex items-center gap-2 rounded-[var(--radius)] px-2 py-1.5",
              index === 0 ? "bg-muted font-medium" : "text-muted-foreground",
            )}
          >
            <DocumentDomainIcon aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">{source.title}</span>
          </li>
        ))}
      </ul>
    </aside>
    <article className="p-6 sm:p-8">
      <h3 className="font-reading text-2xl font-medium">{practiceSources[0].title}</h3>
      <p className="mt-4 font-reading text-lg leading-relaxed">
        A luz do Sol reúne todas as cores.{" "}
        <mark className="rounded-sm bg-[var(--search-match)] px-0.5 text-foreground">
          {practiceSources[0].text}
        </mark>
      </p>
      <p className="mt-6 text-xs text-muted-foreground">
        Conteúdo de exemplo: {practiceSources[0].attribution}
      </p>
    </article>
  </div>
);

/** Shape: the passage becomes proposals that the person reviews before saving. */
export const GenerationDemo = () => {
  const [phase, setPhase] = useState<"idle" | "pending" | "ready">("idle");
  const [kept, setKept] = useState(() => practiceFlashcards.map(() => true));
  const generate = () => {
    if (phase !== "idle") return setPhase("idle");
    setPhase("pending");
    window.setTimeout(() => setPhase("ready"), 1400);
  };
  return (
    <div className="surface-panel p-6 sm:p-8">
      {/* Both proposals come from this passage. */}
      <div className="source-excerpt font-reading text-[0.9375rem] leading-relaxed">
        {practiceSources[0].text} {practiceSources[1].text}
      </div>
      {/* Nothing is reserved: the area grows as the proposals arrive. */}
      <AutoHeight className="-m-1">
        <div className="p-1">
          {phase === "pending" ? (
            <div className="pt-6">
              <GenerationPending />
            </div>
          ) : phase === "ready" ? (
            <ul className="grid gap-2 pt-6">
              {practiceFlashcards.map((card, index) => (
                <li
                  key={card.id}
                  className="landing-arrive flex items-start gap-3 rounded-[var(--radius)] border border-border bg-card p-4"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <Checkbox
                    aria-label={`Incluir: ${card.question}`}
                    checked={kept[index]}
                    className="mt-0.5"
                    onCheckedChange={(value) =>
                      setKept(kept.map((item, i) => (i === index ? value === true : item)))
                    }
                  />
                  <div className={cn("min-w-0", !kept[index] && "text-muted-foreground")}>
                    <p className="font-reading text-lg leading-snug">{card.question}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{card.answer}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </AutoHeight>
      <div className="mt-6 flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {phase === "ready" ? `${kept.filter(Boolean).length} serão salvos` : null}
        </span>
        <Button onClick={generate} variant={phase === "ready" ? "outline" : "default"}>
          <MorphText
            text={
              phase === "pending"
                ? "Gerando…"
                : phase === "ready"
                  ? "Começar de novo"
                  : "Gerar flashcards"
            }
          />
        </Button>
      </div>
    </div>
  );
};

/** Practice: a playable flashcard and a playable quiz, the same parts as the app. */
export const PracticeDemo = () => (
  <Tabs defaultValue="flashcard">
    <TabsList>
      <TabsTrigger value="flashcard">Flashcard</TabsTrigger>
      <TabsTrigger value="quiz">Quiz</TabsTrigger>
    </TabsList>
    <TabsContent value="flashcard">
      <FlashcardDemo />
    </TabsContent>
    <TabsContent value="quiz">
      <QuizDemo />
    </TabsContent>
  </Tabs>
);

/**
 * How a rated card leaves, the same as in the app: forgotten ones go back, easy ones lift. The
 * last card only fades: nothing comes after it, so it must not slide as if another were coming.
 */
const cardExit = (rating: string | null) =>
  rating === "finish"
    ? { opacity: 0, scale: 0.98 }
    : rating === "again"
      ? { opacity: 0, x: 24 }
      : rating === "easy"
        ? { opacity: 0, y: -14, scale: 0.98 }
        : { opacity: 0, x: -20 };

const FlashcardDemo = () => {
  const [state, dispatch] = useReducer(flashcardReducer, undefined, createFlashcardState);
  const reduced = useReducedMotion();
  const easy = useRef<HTMLButtonElement>(null);
  const cardId = state.queue[0];
  const card = practiceFlashcards.find(({ id }) => id === cardId);
  // Every rating is a new step, even when a forgotten card comes straight back.
  const step = Object.values(state.ratings).reduce((sum, count) => sum + count, 0);
  return (
    <div className="practice-sheet">
      {/* The negative margin keeps focus rings inside the clipped, animated height. */}
      <AutoHeight className="-m-1">
        <AnimatePresence custom={card ? state.lastRating : "finish"} initial={false} mode="wait">
          <motion.div
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            className="p-1"
            custom={card ? state.lastRating : "finish"}
            exit={reduced ? { opacity: 0 } : "leave"}
            initial={reduced ? { opacity: 0 } : card ? { opacity: 0, x: 20 } : { opacity: 0, y: 6 }}
            key={card ? `${card.id}-${step}` : "done"}
            transition={{ duration: 0.18, ease: ease.standard }}
            variants={{ leave: cardExit }}
          >
            {!card ? (
              <>
                <p className="practice-kicker">Exemplo concluído</p>
                <p className="font-reading text-2xl">Você revisou os dois flashcards.</p>
                <Button
                  className="mt-6"
                  onClick={() => dispatch({ type: "restart" })}
                  variant="outline"
                >
                  Recomeçar exemplo
                </Button>
              </>
            ) : (
              <>
                <p className="practice-kicker">Pergunta</p>
                <p className="font-reading text-2xl leading-snug">{card.question}</p>
                {!state.revealed ? (
                  <div className="practice-reveal">
                    <Button onClick={() => dispatch({ type: "reveal", cardId: card.id })} size="lg">
                      Mostrar resposta
                    </Button>
                  </div>
                ) : (
                  <StudyReveal>
                    <p className="practice-kicker">Resposta</p>
                    <p className="font-reading text-lg leading-relaxed">{card.answer}</p>
                    <div className="practice-scale-label">
                      <span>Como foi lembrar?</span>
                    </div>
                    <div aria-label="Como foi lembrar?" className="practice-scale" role="group">
                      {practiceRatings.map((rating) => (
                        <button
                          key={rating.value}
                          title={rating.help}
                          ref={rating.value === "easy" ? easy : undefined}
                          className="practice-rating"
                          data-rating={rating.value}
                          onClick={() => {
                            if (rating.value === "easy" && easy.current) goldBurst(easy.current);
                            dispatch({ type: "rate", cardId: card.id, rating: rating.value });
                          }}
                          type="button"
                        >
                          <span className="practice-rating-label">
                            {rating.label}
                            <Kbd>{rating.key}</Kbd>
                          </span>
                          <span className="practice-rating-interval">
                            {exampleIntervals[rating.value]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </StudyReveal>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </AutoHeight>
    </div>
  );
};

const QuizDemo = () => {
  const [state, dispatch] = useReducer(quizReducer, undefined, createQuizState);
  const question = practiceQuizQuestions[0];
  const answer = state.answers[0];
  const checked = state.phase === "completed";
  return (
    <div className="practice-sheet">
      <p className="practice-kicker">Questão</p>
      <p className="font-reading text-2xl leading-snug">{question.question}</p>
      <div className="choices">
        {question.options.map((option, index) =>
          checked ? (
            <StudyAnswerOutcome
              correct={index === question.correctOptionIndex}
              index={index}
              key={option}
              selected={index === answer}
              text={option}
            />
          ) : (
            <StudyAnswerChoice
              index={index}
              key={option}
              onSelect={() =>
                dispatch({ type: "select", questionId: question.id, optionIndex: index })
              }
              selected={index === answer}
              text={option}
            />
          ),
        )}
      </div>
      <div className="practice-footer">
        <span className="self-center text-sm text-muted-foreground">
          {checked ? "No app, a correção vem no fim do quiz." : "Escolha uma alternativa."}
        </span>
        {checked ? (
          <Button onClick={() => dispatch({ type: "restart" })} variant="outline">
            Responder de novo
          </Button>
        ) : (
          <Button
            disabled={answer === null}
            onClick={() => {
              // The example has one question: answer the second silently to complete it.
              dispatch({ type: "navigate", index: 1 });
              dispatch({
                type: "select",
                questionId: practiceQuizQuestions[1].id,
                optionIndex: practiceQuizQuestions[1].correctOptionIndex,
              });
              dispatch({ type: "navigate", index: 0 });
              dispatch({ type: "review" });
              dispatch({ type: "complete" });
            }}
          >
            <CheckIcon /> Conferir
          </Button>
        )}
      </div>
    </div>
  );
};

/** Keep: the stone as it appears on the home page, with example days. */
export const StoneDemo = () => (
  <div className="surface-panel p-6 sm:p-8">
    <StoneCardView stone={exampleStone} />
  </div>
);
