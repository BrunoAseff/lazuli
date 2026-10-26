import { useLayoutEffect, useSyncExternalStore } from "react";

const positions = new Map<string, number>();
export function useMetricsScroll(key: string, ready: boolean) {
  useLayoutEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() =>
      window.scrollTo({ top: positions.get(key) ?? 0, behavior: "auto" }),
    );
    return () => {
      cancelAnimationFrame(frame);
      positions.set(key, window.scrollY);
      if (positions.size > 50) positions.delete(positions.keys().next().value!);
    };
  }, [key, ready]);
}
const subscribe = (update: () => void) => {
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  return () => {
    window.removeEventListener("online", update);
    window.removeEventListener("offline", update);
  };
};
export const useMetricsOnline = () =>
  useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
