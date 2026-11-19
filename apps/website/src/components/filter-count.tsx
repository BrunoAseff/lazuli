import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export const FilterCount = ({ count }: { count: number }) => {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.span
          initial={{ width: 0, scale: 0.6, opacity: 0 }}
          animate={{ width: 20, scale: 1, opacity: 1 }}
          exit={{ width: 0, scale: 0.6, opacity: 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          aria-hidden="true"
          className="flex h-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-action text-xs tabular-nums text-action-foreground"
        >
          {count}
        </motion.span>
      )}
    </AnimatePresence>
  );
};
