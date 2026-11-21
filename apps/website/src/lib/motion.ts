import type { Transition } from "motion/react";

/**
 * The motion of Lazúli, in one place. CSS mirrors the springs as --spring-{snap,morph,settle}
 * (styles/identity.css).
 * - snap: press and toggle feedback, crisp and without overshoot.
 * - morph: a highlight or marker travelling between options, with a small overshoot.
 * - settle: something arriving (a card, a panel): slower, and it lands without bouncing.
 * - smooth: a size that follows new content (a height, a width, a bar): 300ms, no overshoot.
 */
export const spring = {
  snap: { type: "spring", stiffness: 700, damping: 42, mass: 0.6 },
  morph: { type: "spring", stiffness: 400, damping: 30 },
  settle: { type: "spring", stiffness: 210, damping: 26 },
  smooth: { type: "spring", visualDuration: 0.3, bounce: 0 },
} as const satisfies Record<string, Transition>;

/** Curves for tweens: entering, moving while on screen, and the everyday standard. */
export const ease = {
  enter: [0.16, 1, 0.3, 1],
  standard: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;

/** Press scale for buttons and pressable cards. */
export const pressScale = 0.97;
