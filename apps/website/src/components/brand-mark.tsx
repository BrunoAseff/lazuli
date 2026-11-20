import type { ComponentProps } from "react";

import { cn } from "@/lib/utils.ts";

/*
 * A cut lapis seen from above: a flat table and four facets lit from the top left, with one pyrite
 * fleck. Colors come from --facet-* so the stone reads in both themes.
 */
const outer = { top: "12 1.5", right: "22.5 12", bottom: "12 22.5", left: "1.5 12" };
const table = { top: "12 7.2", right: "16.8 12", bottom: "12 16.8", left: "7.2 12" };

export const GemMark = ({
  className,
  size = 24,
  fleck = true,
  ...props
}: ComponentProps<"svg"> & { size?: number; fleck?: boolean }) => (
  <svg
    aria-hidden="true"
    className={cn("shrink-0", className)}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      data-facet="1"
      fill="var(--facet-1)"
      d={`M${outer.left} L${outer.top} L${table.top} L${table.left}Z`}
    />
    <path
      data-facet="2"
      fill="var(--facet-2)"
      d={`M${outer.top} L${outer.right} L${table.right} L${table.top}Z`}
    />
    <path
      data-facet="3"
      fill="var(--facet-3)"
      d={`M${outer.right} L${outer.bottom} L${table.bottom} L${table.right}Z`}
    />
    <path
      data-facet="4"
      fill="var(--facet-4)"
      d={`M${outer.bottom} L${outer.left} L${table.left} L${table.bottom}Z`}
    />
    <path
      data-facet="table"
      fill="var(--facet-table)"
      d={`M${table.top} L${table.right} L${table.bottom} L${table.left}Z`}
    />
    {fleck && <path fill="var(--gold, var(--pyrite))" d="M14.6 8.6 15.9 9.9 14.6 11.2 13.3 9.9Z" />}
  </svg>
);

/** The wordmark: "Lazúli" set in Newsreader, the accent of the ú cut as a gold facet. */
export const LazuliWordmark = ({
  className,
  mark = true,
  ...props
}: ComponentProps<"span"> & { mark?: boolean }) => (
  <span className={cn("lz-wordmark text-[1.375rem]", className)} {...props}>
    {/* Optical alignment: the gem spans the cap height (not the line box, which drops it below
        the baseline), and its left point overshoots so the diamond reads flush with the column. */}
    {mark && <GemMark className="lz-wordmark-gem" />}
    <span className="lz-wordmark-word" aria-hidden="true">
      Laz<span className="lz-wordmark-u">u</span>li
    </span>
    <span className="sr-only">Lazúli</span>
  </span>
);

/** Loading: light travels across the cut, facet by facet. Pair it with a visible text. */
export const GemLoader = ({ className, size = 28 }: { className?: string; size?: number }) => (
  <GemMark className={cn("lz-gem-loader", className)} size={size} />
);

/** The facet (◆): the state marker of the whole interface. Decorative; the meaning lives in text. */
export const Facet = ({
  state = "active",
  className,
  ...props
}: ComponentProps<"span"> & { state?: "idle" | "active" | "gold" }) => (
  <span aria-hidden="true" className={cn("facet", className)} data-state={state} {...props} />
);
