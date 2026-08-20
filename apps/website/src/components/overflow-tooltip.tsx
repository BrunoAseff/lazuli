import { useLayoutEffect, useRef, useState, type ReactElement, type RefObject } from "react";

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

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const next = element.scrollWidth > element.clientWidth;
      setTruncated(next);
      if (!next) setOpen(false);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return (
    <Tooltip onOpenChange={(value) => setOpen(value && truncated)} open={open && truncated}>
      <TooltipTrigger asChild>{children(ref)}</TooltipTrigger>
      {truncated && (
        <TooltipContent className="max-w-sm [overflow-wrap:anywhere]" side={side}>
          {text}
        </TooltipContent>
      )}
    </Tooltip>
  );
};
