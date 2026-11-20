import {
  cloneElement,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";

export const OverflowTooltip = ({
  children,
  side,
  text,
}: {
  children: (ref: RefObject<HTMLElement | null>) => ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  text: string;
}) => {
  const ref = useRef<HTMLElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [open, setOpen] = useState(false);
  const [needsFocus, setNeedsFocus] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const next =
        element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;
      setTruncated(next);
      setNeedsFocus(
        next && !element.closest("a[href],button,input,select,textarea,[contenteditable=true]"),
      );
      if (!next) setOpen(false);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    // Layout can settle after the first measure without a resize (fonts, a parent's grid);
    // checking again on approach keeps the tooltip honest.
    element.addEventListener("pointerenter", measure);
    element.addEventListener("focus", measure);
    return () => {
      observer?.disconnect();
      element.removeEventListener("pointerenter", measure);
      element.removeEventListener("focus", measure);
    };
  }, [text]);

  const child = children(ref) as ReactElement<{ tabIndex?: number }>;
  return (
    <Tooltip onOpenChange={(value) => setOpen(value && truncated)} open={open && truncated}>
      <TooltipTrigger asChild>
        {needsFocus && child.props.tabIndex === undefined
          ? cloneElement(child, { tabIndex: 0 })
          : child}
      </TooltipTrigger>
      {truncated && (
        <TooltipContent className="max-w-sm [overflow-wrap:anywhere]" side={side}>
          {text}
        </TooltipContent>
      )}
    </Tooltip>
  );
};
