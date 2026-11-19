/** Radix handles Escape in document capture, before React's bubbling input handler. */
export function preserveLocalEscape(event: KeyboardEvent) {
  if (event.target instanceof Element && event.target.closest("[data-local-escape]")) {
    event.preventDefault();
  }
}
