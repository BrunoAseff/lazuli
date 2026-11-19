import { useRef } from "react";

/** A controlled overlay can open without a Radix Trigger. Explicit caller behavior wins. */
export function useOverlayFocusReturn({
  onOpenAutoFocus,
  onCloseAutoFocus,
}: {
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      opener.current =
        document.activeElement instanceof HTMLElement && document.activeElement !== document.body
          ? document.activeElement
          : null;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event);
      if (!event.defaultPrevented && opener.current?.isConnected) {
        event.preventDefault();
        opener.current.focus({ preventScroll: true });
      }
    },
  };
}
