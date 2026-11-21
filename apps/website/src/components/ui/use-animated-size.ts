import { useCallback, useEffect, useRef, type Ref } from "react";

/** The same curve and length as the rest of the interface's size changes. */
const DURATION = 260;
const EASING = "cubic-bezier(0.23, 1, 0.32, 1)";

type Size = { height: number; width: number };

const differs = (a: Size, b: Size) =>
  Math.abs(a.height - b.height) > 1 || Math.abs(a.width - b.width) > 1;

const sizeOf = (node: HTMLElement): Size => ({
  height: node.offsetHeight,
  width: node.offsetWidth,
});

/**
 * A dialog that changes size with its content (a preview appears, a step swaps) grows and shrinks
 * to the new size instead of jumping. If the content changes again mid-way, the motion turns
 * toward the new size from wherever it is. Regions that animate their own height (AutoHeight)
 * are followed as they move, so the two never fight.
 */
export const useAnimatedSize = <T extends HTMLElement>(enabled = true) => {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  return useCallback(
    (node: T | null) => {
      cleanup.current?.();
      cleanup.current = null;
      if (!node || !enabled || typeof ResizeObserver === "undefined") return;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
      let last: Size | null = null;
      let running: { animation: Animation; from: Size; to: Size } | null = null;

      const start = (from: Size, to: Size, time = 0) => {
        const animation = node.animate(
          [
            { height: `${from.height}px`, overflow: "hidden", width: `${from.width}px` },
            { height: `${to.height}px`, overflow: "hidden", width: `${to.width}px` },
          ],
          { duration: DURATION, easing: EASING },
        );
        animation.currentTime = time;
        running = { animation, from, to };
        animation.onfinish = () => {
          if (running?.animation === animation) running = null;
          last = to;
        };
      };

      const observer = new ResizeObserver(() => {
        if (running) {
          // Our own frames resize the box too: look at the size the content wants now.
          const { animation, from, to } = running;
          const visual = sizeOf(node);
          const time = Number(animation.currentTime ?? 0);
          animation.onfinish = null;
          animation.cancel();
          running = null;
          const natural = sizeOf(node);
          if (differs(natural, to)) start(visual, natural);
          else start(from, to, time);
          return;
        }
        const next = sizeOf(node);
        const from = last;
        last = next;
        if (!from || reduce?.matches || !differs(from, next)) return;
        if (node.querySelector("[data-auto-height][data-animating]")) return;
        start(from, next);
      });
      observer.observe(node);
      cleanup.current = () => {
        observer.disconnect();
        running?.animation.cancel();
      };
    },
    [enabled],
  );
};

/**
 * One stable ref callback for the animated box and the ref the caller passed: a new function each
 * render would reconnect the observer and lose the size it compares against.
 */
export const useMergedRef = <T>(own: (node: T | null) => void, outer: Ref<T> | undefined) =>
  useCallback(
    (node: T | null) => {
      own(node);
      if (typeof outer === "function") outer(node);
      else if (outer) (outer as { current: T | null }).current = node;
    },
    [own, outer],
  );
