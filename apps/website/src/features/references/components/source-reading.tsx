import type React from "react";
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { useSourceReading } from "./source-reading-context.ts";
import "./source-reading.css";

/** A bounded excerpt that can be read in full without growing the enclosing dialog. */
export function SourceReading({
  text,
  label = "Texto da fonte",
  expandLabel = "Ler fonte completa",
  children,
}: {
  text: string;
  label?: string;
  expandLabel?: string;
  children?: ReactNode;
}) {
  const id = useId();
  const content = useRef<HTMLDivElement>(null);
  const shared = useSourceReading();
  const fill = Boolean(shared?.fill);
  const [expanded, setExpanded] = useState(false);
  // Scrolling is allowed only once the opening animation has finished: during it the content is
  // always taller than the box, which would flash a scrollbar.
  const [settled, setSettled] = useState(false);
  const [overflows, setOverflows] = useState(false);
  // Full height of the text, so opening and closing can animate between two real heights.
  const [fullHeight, setFullHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const node = content.current;
    if (!node) return;
    const measure = () => {
      setOverflows(node.scrollHeight > node.clientHeight + 1);
      setFullHeight(node.scrollHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [text, expanded, children]);
  return (
    <div className="min-w-0">
      <div
        ref={content}
        id={id}
        role="region"
        aria-label={label}
        tabIndex={expanded || fill ? 0 : undefined}
        data-source-reading
        data-expanded={expanded}
        data-settled={(expanded && settled) || undefined}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget && event.propertyName === "max-height")
            setSettled(expanded);
        }}
        data-clipped={(!expanded && overflows && !fill) || undefined}
        data-fill={fill || undefined}
        className="source-reading lazuli-thin-scrollbar"
        style={
          fullHeight ? ({ "--source-full": `${fullHeight}px` } as React.CSSProperties) : undefined
        }
      >
        {children ?? text.split(/\n\n+/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>
      {!fill && (overflows || expanded) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 -ml-2 text-muted-foreground hover:text-foreground"
          aria-controls={id}
          aria-expanded={expanded}
          onClick={() => {
            setSettled(false);
            setExpanded(!expanded);
          }}
        >
          {expanded ? "Recolher" : expandLabel}
          <ChevronDownIcon
            className={cn("transition-transform duration-200", expanded && "rotate-180")}
          />
        </Button>
      )}
    </div>
  );
}
