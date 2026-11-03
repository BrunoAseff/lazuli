import type { MouseEvent } from "react";

/** A public entry starts at the form heading; modified clicks retain native link behavior. */
export function resetAccountEntryScroll(event: MouseEvent<HTMLAnchorElement>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  window.scrollTo({ top: 0, behavior: "instant" });
}
