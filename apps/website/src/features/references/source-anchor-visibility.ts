import { useSyncExternalStore } from "react";

/*
 * Whether the passages linked to study materials are marked in the document's text. A reading
 * preference of this browser: some documents have so many links that the marks get in the way.
 */
const key = "lazuli-source-anchors";
const listeners = new Set<() => void>();

const read = () => {
  try {
    return localStorage.getItem(key) !== "hidden";
  } catch {
    return true;
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
};

export const setSourceAnchorsShown = (shown: boolean) => {
  try {
    if (shown) localStorage.removeItem(key);
    else localStorage.setItem(key, "hidden");
  } catch {
    // Storage blocked: the choice still holds until the page reloads.
  }
  for (const listener of listeners) listener();
};

export const useSourceAnchorsShown = () => useSyncExternalStore(subscribe, read, () => true);
