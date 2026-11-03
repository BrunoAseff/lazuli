import { ArrowUpRight } from "lucide-react";

export const NewTabIndicator = () => (
  <>
    <ArrowUpRight aria-hidden="true" className="ml-1 inline size-3.5 shrink-0 align-[-0.125em]" />
    <span className="sr-only"> (abre em nova aba)</span>
  </>
);
