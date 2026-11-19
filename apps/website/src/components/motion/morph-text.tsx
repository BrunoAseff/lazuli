import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { spring } from "@/lib/motion.ts";

/**
 * A label that changes in place (e.g. "Gerar com IA" → "Gerando…" → "Revisar propostas"): letters
 * that differ rise from a soft blur, shared ones stay put, and the width follows on a spring.
 * Screen readers get the plain text once; the letters are decoration.
 */
export const MorphText = ({ text, className }: { text: string; className?: string }) => {
  const reduced = useReducedMotion();
  // Keyed by character and its occurrence, so a letter present before and after keeps its node.
  const seen = new Map<string, number>();
  // Grapheme-safe split, so accented letters and emoji stay whole.
  const graphemes = Array.from(new Intl.Segmenter("pt-BR").segment(text), (part) => part.segment);
  const letters = graphemes.map((char) => {
    const count = seen.get(char) ?? 0;
    seen.set(char, count + 1);
    return { char, key: `${char}-${count}` };
  });
  if (reduced) return <span className={className}>{text}</span>;
  return (
    <motion.span layout="size" transition={spring.snap} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="inline-flex whitespace-pre">
        <AnimatePresence initial={false} mode="popLayout">
          {letters.map(({ char, key }) => (
            <motion.span
              key={key}
              layout="position"
              initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -6, filter: "blur(3px)" }}
              transition={spring.snap}
            >
              {char}
            </motion.span>
          ))}
        </AnimatePresence>
      </span>
    </motion.span>
  );
};
