import { motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { motionTokens } from "@/components/arc/motion-tokens.ts";

/**
 * Lets a region change size with its content instead of freezing a height:
 * switching tabs or states grows and shrinks the surrounding surface continuously.
 */
export const AutoHeight = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div
      animate={{ height }}
      className={className}
      initial={false}
      style={{ overflow: "hidden" }}
      transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
    >
      <div ref={inner}>{children}</div>
    </motion.div>
  );
};
