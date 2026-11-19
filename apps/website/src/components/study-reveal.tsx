import { useEffect, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens.ts";

/**
 * The question stays anchored. A line of ink is drawn under it, as when underlining what was recalled,
 * and the answer settles below that line. Keyboard and reduced motion receive the final state at once.
 */
export function StudyReveal({
  children,
  animated = true,
  label,
}: {
  children: ReactNode;
  animated?: boolean;
  label?: string;
}) {
  const reduced = useReducedMotion();
  const move = animated && !reduced;
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (label) region.current?.focus({ preventScroll: true });
  }, [label]);
  return (
    <div
      ref={region}
      role={label ? "region" : undefined}
      aria-label={label}
      tabIndex={label ? -1 : undefined}
      className="outline-none"
    >
      <motion.span
        aria-hidden="true"
        className="study-reveal-rule"
        initial={move ? { scaleX: 0 } : false}
        animate={{ scaleX: 1 }}
        transition={{ duration: move ? 0.32 : 0, ease: motionTokens.ease.enter }}
      />
      <motion.div
        initial={move ? { opacity: 0, y: 6 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: move ? 0.24 : 0,
          delay: move ? 0.14 : 0,
          ease: motionTokens.ease.enter,
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
