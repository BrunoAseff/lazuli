import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import { MinusIcon, PlusIcon } from "@/components/icons.tsx";
import { cn } from "@/lib/utils.ts";
import { spring } from "@/lib/motion.ts";

/**
 * A small number with − and +. The number rolls the way it changed (up for more, down for less),
 * the pressed side gives way under the finger, and the value can still be typed.
 */
export const NumberStepper = ({
  active = true,
  className,
  decreaseLabel,
  increaseLabel,
  label,
  max,
  min,
  onChange,
  onFocus,
  value,
}: {
  /** Off, the stepper rests a little faded until it is pointed at or used. */
  active?: boolean;
  className?: string;
  decreaseLabel: string;
  increaseLabel: string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  onFocus?: () => void;
  value: number;
}) => {
  const reduced = useReducedMotion();
  const [typing, setTyping] = useState(false);
  // Which way the last change went, so the number rolls that way.
  const [last, setLast] = useState(value);
  const [direction, setDirection] = useState(0);
  if (value !== last) {
    setDirection(value > last ? 1 : -1);
    setLast(value);
  }
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next)));
  const roll = reduced ? 0 : 90;
  const variants = {
    enter: (way: number) => ({ y: `${way * roll}%`, opacity: 0, filter: "blur(2px)" }),
    center: { y: "0%", opacity: 1, filter: "blur(0px)" },
    exit: (way: number) => ({ y: `${-way * roll}%`, opacity: 0, filter: "blur(2px)" }),
  };

  const side = (delta: -1 | 1) => {
    const disabled = active && (delta < 0 ? value <= min : value >= max);
    const Icon = delta < 0 ? MinusIcon : PlusIcon;
    return (
      <motion.button
        aria-label={delta < 0 ? decreaseLabel : increaseLabel}
        className="grid place-items-center text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-35"
        disabled={disabled}
        onClick={() => onChange(clamp(value + delta))}
        type="button"
        whileTap={reduced ? undefined : { scale: 0.82 }}
      >
        <Icon aria-hidden="true" className="size-3.5" />
      </motion.button>
    );
  };

  return (
    <div
      className={cn(
        "inline-grid h-8 grid-cols-[2rem_2.5rem_2rem] overflow-hidden rounded-[var(--radius)] border bg-card transition-[border-color,opacity,box-shadow] duration-200",
        active
          ? "border-primary/45 shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_10%,transparent)]"
          : "border-input opacity-60 hover:opacity-100 focus-within:opacity-100",
        className,
      )}
    >
      {side(-1)}
      <span className="relative grid place-items-center border-x border-input/70">
        <input
          aria-label={label}
          className={cn(
            "size-full bg-transparent text-center text-sm tabular-nums outline-none",
            !typing && "text-transparent caret-transparent",
          )}
          inputMode="numeric"
          onBlur={() => setTyping(false)}
          onChange={(event) => {
            const next = Number(event.target.value.replace(/\D/g, "").slice(-2));
            if (event.target.value !== "" && Number.isFinite(next)) onChange(clamp(next));
          }}
          onFocus={(event) => {
            setTyping(true);
            event.target.select();
            onFocus?.();
          }}
          type="text"
          value={value}
        />
        {/* The rolling number, drawn over the field while it is not being typed in. */}
        {!typing && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden text-sm tabular-nums"
          >
            <AnimatePresence custom={direction} initial={false} mode="popLayout">
              <motion.span
                animate="center"
                className="block"
                custom={direction}
                exit="exit"
                initial="enter"
                key={value}
                variants={variants}
                transition={spring.snap}
              >
                {value}
              </motion.span>
            </AnimatePresence>
          </span>
        )}
      </span>
      {side(1)}
    </div>
  );
};
