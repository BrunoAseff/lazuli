import type { Transition } from "motion/react";

/**
 * The three springs of Lazúli. CSS mirrors them as --spring-{snap,morph,settle} (styles/identity.css).
 * - snap: press and toggle feedback, crisp and without overshoot.
 * - morph: a highlight or marker travelling between options, with a small overshoot.
 * - settle: something arriving (a card, a panel): slower, and it lands without bouncing.
 */
export const spring = {
  snap: { type: "spring", stiffness: 700, damping: 42, mass: 0.6 },
  morph: { type: "spring", stiffness: 400, damping: 30 },
  settle: { type: "spring", stiffness: 210, damping: 26 },
} as const satisfies Record<string, Transition>;

/** Press scale for buttons and pressable cards. */
export const pressScale = 0.97;
