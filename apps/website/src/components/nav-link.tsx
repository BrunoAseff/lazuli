import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router";

import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons.tsx";
import { cn } from "@/lib/utils.ts";

/** One way back everywhere: arrow and label form a single target with the same hover and focus. */
export const BackLink = ({
  children,
  className,
  ...props
}: ComponentProps<typeof Link> & { children: ReactNode }) => (
  <Link className={cn("back-link", className)} {...props}>
    <ArrowLeftIcon aria-hidden="true" />
    <span className="min-w-0 truncate">{children}</span>
  </Link>
);

/** Same anatomy when going back must first ask something (e.g. leaving an attempt). */
export const BackButton = ({
  children,
  className,
  ...props
}: ComponentProps<"button"> & { children: ReactNode }) => (
  <button className={cn("back-link", className)} type="button" {...props}>
    <ArrowLeftIcon aria-hidden="true" />
    <span className="min-w-0 truncate">{children}</span>
  </button>
);

/** The way onward from a section ("Ver coleções"): the mirror of BackLink, never a blue text link. */
export const ForwardLink = ({
  children,
  className,
  ...props
}: ComponentProps<typeof Link> & { children: ReactNode }) => (
  <Link className={cn("back-link forward-link", className)} {...props}>
    <span className="min-w-0 truncate">{children}</span>
    <ArrowRightIcon aria-hidden="true" />
  </Link>
);
