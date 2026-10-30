import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { animate } from "animejs";
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, X, XCircle } from "lucide-react";
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
  quizFeedback,
  quizReducer,
  quizScore,
} from "./practice-state.ts";

import { transferInk } from "./ink-transfer.ts";
import type { PaperOrigin } from "./study-sheet.tsx";

function Sources({ indices = [0, 1] }: { indices?: number[] }) {
  return (
    <div className="lp-source-list">
      {indices.map((index) => {
        const source = practiceSources[index]!;
        return (
          <details key={source.id}>
            <summary>Voltar ao trecho: {source.title}</summary>
            <p>{source.text}</p>
            <a href={source.url} target="_blank" rel="noreferrer">
              Fonte do exemplo: {source.attribution}
            </a>
          </details>
        );
      })}
    </div>
  );
}

export function PracticeExperience({
  onClose,
  origin,
  initialMode = "cards",
}: {
  onClose: () => void;
  origin: PaperOrigin | null;
  initialMode?: "cards" | "quiz";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const lastPage = useRef<string | null>(null);
  const stopEntrance = useRef<(() => void) | null>(null);
  const [mode, setMode] = useState<"cards" | "quiz">(initialMode);
  const [flash, sendFlash] = useReducer(flashcardReducer, undefined, createFlashcardState);
  const [quiz, sendQuiz] = useReducer(quizReducer, undefined, createQuizState);
  const card = practiceFlashcards.find((item) => item.id === flash.queue[0]);
  const question = practiceQuizQuestions[quiz.index]!;
  const feedback = quizFeedback(quiz);
  const pageKey =
    mode === "cards"
      ? `${card?.id ?? "done"}:${flash.ratings.again}`
      : `${quiz.phase}:${quiz.index}`;

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const scroll = document.body.style.overflowY;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    element.showModal();
    document.body.style.overflowY = "hidden";
    const surface = paper.current;
    let entrance: ReturnType<typeof animate> | undefined;
    let stopInk: (() => void) | undefined;
    if (surface && origin && !reduced.matches) {
      const destination = surface.getBoundingClientRect();
      const word = surface.querySelector<HTMLElement>("[data-ink-word]");
      if (word) stopInk = transferInk(origin, word, element);
      entrance = animate(surface, {
        translateX: [origin.x - destination.x, 0],
        translateY: [origin.y - destination.y, 0],
        scaleX: [origin.width / destination.width, 1],
        scaleY: [origin.height / destination.height, 1],
        duration: 720,
        ease: "out(4)",
      });
    }
    let stopped = false;
    const stopMotion = () => {
      if (stopped) return;
      stopped = true;
      stopInk?.();
      entrance?.revert();
      reduced.removeEventListener("change", stopMotion);
      window.removeEventListener("resize", stopMotion);
      window.removeEventListener("orientationchange", stopMotion);
      window.visualViewport?.removeEventListener("resize", stopMotion);
      element.removeEventListener("scroll", stopMotion);
      if (stopEntrance.current === stopMotion) stopEntrance.current = null;
    };
    stopEntrance.current = stopMotion;
    reduced.addEventListener("change", stopMotion);
    window.addEventListener("resize", stopMotion);
    window.addEventListener("orientationchange", stopMotion);
    window.visualViewport?.addEventListener("resize", stopMotion);
    element.addEventListener("scroll", stopMotion, { passive: true });
    return () => {
      stopMotion();
      element.close();
      document.body.style.overflowY = scroll;
    };
  }, []);

  useLayoutEffect(() => {
    const element = paper.current;
    if (!element) return;
    const changed = lastPage.current !== null && lastPage.current !== pageKey;
    lastPage.current = pageKey;
    if (changed) stopEntrance.current?.();
    element.querySelector<HTMLHeadingElement>("h2")?.focus({ preventScroll: true });
    dialog.current?.scrollTo({ top: 0, behavior: "instant" });
    if (!changed || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = animate(element, {
      rotateY: [-5, 0],
      translateX: [22, 0],
      duration: 520,
      ease: "out(4)",
    });
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const stopMotion = () => {
      animation.revert();
    };
    reduced.addEventListener("change", stopMotion);
    return () => {
      reduced.removeEventListener("change", stopMotion);
      stopMotion();
    };
  }, [pageKey]);

  useEffect(() => {
    if (!flash.revealed || mode !== "cards") return;
    const answer = paper.current?.querySelector<HTMLElement>(".lp-practice-answer");
    const text = answer?.querySelector<HTMLElement>(".lp-answer-text");
    text?.focus({ preventScroll: true });
    text?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    if (!answer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = animate(answer, {
      translateY: [12, 0],
      scaleY: [0.96, 1],
      duration: 420,
      ease: "out(3)",
    });
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const stopMotion = () => {
      animation.revert();
    };
    reduced.addEventListener("change", stopMotion);
    return () => {
      reduced.removeEventListener("change", stopMotion);
      stopMotion();
    };
  }, [flash.revealed, mode]);

  return (
    <dialog
      ref={dialog}
      className="lp-dialog"
      aria-label="Experimente a prática do Lazúli"
      onCancel={onClose}
    >
      <div className="lp-practice-shell">
        <nav className="lp-practice-nav" aria-label="Demonstração">
          <button onClick={onClose}>
            <X size={19} aria-hidden="true" /> Voltar à página
          </button>
          <div className="lp-practice-switch" aria-label="Modalidade">
            <button aria-pressed={mode === "cards"} onClick={() => setMode("cards")}>
              Flashcards
            </button>
            <button aria-pressed={mode === "quiz"} onClick={() => setMode("quiz")}>
              Quiz
            </button>
          </div>
        </nav>
        <div className="lp-practice-paper" ref={paper}>
          {mode === "cards" ? (
            <>
              <div className="lp-practice-meta" role="status">
                <span>Flashcards de exemplo</span>
                <span>
                  {practiceFlashcards.length - flash.queue.length} de {practiceFlashcards.length}{" "}
                  concluídos
                </span>
              </div>
              {card ? (
                <>
                  <h2 tabIndex={-1}>
                    {card.id === "sky-blue" ? (
                      <>
                        Por que o céu é <span data-ink-word>azul</span>?
                      </>
                    ) : (
                      card.question
                    )}
                  </h2>
                  {!flash.revealed ? (
                    <>
                      <p className="lp-practice-prompt">
                        Tente lembrar antes de consultar a resposta.
                      </p>
                      <button
                        className="lp-button"
                        onClick={() => sendFlash({ type: "reveal", cardId: card.id })}
                      >
                        Mostrar resposta <ArrowRight size={20} aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <div
                      className="lp-practice-answer"
                      role="region"
                      aria-label="Resposta do flashcard"
                    >
                      <p className="lp-answer-text" tabIndex={-1}>
                        {card.answer}
                      </p>
                      <p className="lp-ratings-label">Como foi lembrar?</p>
                      <div className="lp-ratings">
                        {practiceRatings.map((rating) => (
                          <button
                            key={rating.value}
                            title={rating.help}
                            onClick={() =>
                              sendFlash({ type: "rate", cardId: card.id, rating: rating.value })
                            }
                          >
                            {rating.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {flash.lastRating === "again" && (
                    <p className="lp-repeat-note" role="status">
                      O cartão voltou ao fim da fila.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <h2 tabIndex={-1}>Flashcards concluídos.</h2>
                  <p className="lp-practice-result">
                    Consulte o conteúdo que você acabou de revisar.
                  </p>
                  <Sources />
                  <button className="lp-text-button" onClick={() => sendFlash({ type: "restart" })}>
                    <RotateCcw size={18} aria-hidden="true" /> Praticar novamente
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <div className="lp-practice-meta" role="status">
                <span>Quiz de exemplo</span>
                <span>
                  {quiz.phase === "completed"
                    ? `${quizScore(quiz)} de 2 corretas`
                    : quiz.phase === "reviewing"
                      ? "Revisão das respostas"
                      : `Questão ${quiz.index + 1} de 2`}
                </span>
              </div>
              {quiz.phase === "reviewing" ? (
                <>
                  <h2 tabIndex={-1}>Confira antes de concluir.</h2>
                  <ol className="lp-quiz-review">
                    {practiceQuizQuestions.map((item, index) => (
                      <li key={item.id}>
                        <p>{item.question}</p>
                        <span>
                          {quiz.answers[index] === null
                            ? "Ainda não respondida"
                            : item.options[quiz.answers[index]!]}
                        </span>
                        <button
                          className="lp-text-button"
                          onClick={() => sendQuiz({ type: "navigate", index })}
                        >
                          {quiz.answers[index] === null ? "Responder" : "Alterar resposta"}
                        </button>
                      </li>
                    ))}
                  </ol>
                  <button
                    className="lp-button"
                    disabled={quiz.answers.some((answer) => answer === null)}
                    onClick={() => sendQuiz({ type: "complete" })}
                  >
                    Concluir e ver resultado <ArrowRight size={20} aria-hidden="true" />
                  </button>
                  {quiz.answers.some((answer) => answer === null) && (
                    <p className="lp-repeat-note">Responda às duas questões para concluir.</p>
                  )}
                </>
              ) : (
                <>
                  <h2 tabIndex={-1} id="lp-quiz-question">
                    {question.question}
                  </h2>
                  {quiz.phase === "answering" ? (
                    <fieldset className="lp-quiz-options" aria-labelledby="lp-quiz-question">
                      {question.options.map((option, index) => (
                        <label key={option}>
                          <input
                            type="radio"
                            name={`quiz-${question.id}`}
                            checked={quiz.answers[quiz.index] === index}
                            onChange={() =>
                              sendQuiz({
                                type: "select",
                                questionId: question.id,
                                optionIndex: index,
                              })
                            }
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    feedback && (
                      <>
                        <div className="lp-quiz-feedback">
                          {!feedback.correct && (
                            <div className="lp-result-option is-incorrect">
                              <XCircle size={22} aria-hidden="true" />
                              <div>
                                <strong>Sua resposta está incorreta</strong>
                                <p>{question.options[feedback.selectedOptionIndex]}</p>
                              </div>
                            </div>
                          )}
                          <div className="lp-result-option is-correct">
                            <CheckCircle2 size={22} aria-hidden="true" />
                            <div>
                              <strong>
                                {feedback.correct ? "Você acertou" : "Resposta correta"}
                              </strong>
                              <p>{question.options[feedback.correctOptionIndex]}</p>
                            </div>
                          </div>
                        </div>
                        <Sources indices={[feedback.sourceIndex]} />
                      </>
                    )
                  )}
                  <div className="lp-quiz-nav">
                    <button
                      className="lp-text-button"
                      disabled={quiz.index === 0}
                      onClick={() => sendQuiz({ type: "navigate", index: quiz.index - 1 })}
                    >
                      <ArrowLeft size={18} aria-hidden="true" /> Anterior
                    </button>
                    {quiz.index < practiceQuizQuestions.length - 1 ? (
                      <button
                        className="lp-button"
                        onClick={() => sendQuiz({ type: "navigate", index: quiz.index + 1 })}
                      >
                        Próxima <ArrowRight size={20} aria-hidden="true" />
                      </button>
                    ) : quiz.phase === "answering" ? (
                      <button className="lp-button" onClick={() => sendQuiz({ type: "review" })}>
                        Revisar respostas <ArrowRight size={20} aria-hidden="true" />
                      </button>
                    ) : (
                      <button
                        className="lp-text-button"
                        onClick={() => sendQuiz({ type: "restart" })}
                      >
                        <RotateCcw size={18} aria-hidden="true" /> Refazer quiz
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <p className="lp-practice-note">Exemplo interativo. Seu progresso aqui não é salvo.</p>
      </div>
    </dialog>
  );
}
