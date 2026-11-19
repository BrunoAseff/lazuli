import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens.ts";
import { CheckIcon, XIcon } from "./icons.tsx";
import "./study-answer-choice.css";

type Outcome = "correct" | "incorrect";

/** Letter seal: ink fills it from the center when chosen; the letter yields to the result glyph. */
export const ChoiceSeal = ({
  index,
  filled,
  outcome,
}: {
  index: number;
  filled: boolean;
  outcome?: Outcome;
}) => {
  const reduced = useReducedMotion();
  // Choosing is not grading: a chosen letter stays a letter until the result reveals correctness.
  const glyph = outcome === "incorrect" ? "x" : outcome === "correct" ? "check" : "letter";
  return (
    <span aria-hidden="true" className="choice-seal" data-outcome={outcome}>
      <motion.span
        className="choice-seal-fill"
        initial={false}
        animate={{ scale: filled || outcome ? 1 : 0 }}
        transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
      />
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ opacity: 1, scale: 1 }}
          className="choice-seal-glyph"
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          key={glyph}
          transition={{ duration: reduced ? 0 : 0.14, ease: motionTokens.ease.enter }}
        >
          {glyph === "check" ? (
            <CheckIcon className="size-3.5" />
          ) : glyph === "x" ? (
            <XIcon className="size-3.5" />
          ) : (
            String.fromCharCode(65 + index)
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

/** A quiz choice keeps its text anchored; only its seal and surface respond to the choice. */
export function StudyAnswerChoice({
  text,
  index,
  selected,
  disabled,
  onSelect,
}: {
  text: string;
  index: number;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className="choice"
      data-selected={selected || undefined}
      disabled={disabled}
      onClick={onSelect}
    >
      <ChoiceSeal filled={selected} index={index} />
      <span className="choice-text">{text}</span>
    </button>
  );
}

/** The same anatomy after the attempt: the correct answer and a wrong pick are marked, not boxed. */
export function StudyAnswerOutcome({
  text,
  index,
  correct,
  selected,
  reveal = true,
}: {
  text: string;
  index: number;
  correct: boolean;
  selected: boolean;
  /** Play the one-time outcome motion (glint on the right answer, shake on a wrong pick). */
  reveal?: boolean;
}) {
  const outcome: Outcome | undefined = correct ? "correct" : selected ? "incorrect" : undefined;
  return (
    <div
      className="choice"
      data-outcome={outcome}
      data-reveal={(reveal && outcome) || undefined}
      data-static=""
    >
      <ChoiceSeal filled={false} index={index} outcome={outcome} />
      <span className="choice-text">
        {text}
        {(correct || selected) && (
          <span className="choice-note">
            {selected && correct
              ? "Sua resposta · correta"
              : selected
                ? "Sua resposta"
                : "Resposta correta"}
          </span>
        )}
      </span>
    </div>
  );
}
