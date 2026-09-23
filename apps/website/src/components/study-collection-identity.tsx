import type { ReactNode, Ref } from "react";
import { Link } from "react-router";

import { HighlightText } from "@/components/highlight-text.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { Badge } from "@/components/ui/badge.tsx";

export const StudyCollectionIdentity = ({
  href,
  icon,
  metadata,
  projectTitle,
  query,
  title,
}: {
  href: string;
  icon: ReactNode;
  metadata?: ReactNode;
  projectTitle?: string | null;
  query: string;
  title: string;
}) => (
  <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3">
    <div className="row-span-2">{icon}</div>
    <div className="min-w-0">
      <OverflowTooltip text={title}>
        {(ref) => (
          <Link
            className="truncate font-heading text-xl font-medium underline-offset-4 hover:underline"
            ref={ref as Ref<HTMLAnchorElement>}
            to={href}
          >
            <HighlightText query={query} text={title} />
          </Link>
        )}
      </OverflowTooltip>
    </div>
    {metadata ? (
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{metadata}</p>
    ) : (
      <OverflowTooltip text={projectTitle ?? "Sem projeto"}>
        {(ref) => (
          <Badge className="mt-2 max-w-full" ref={ref as Ref<HTMLSpanElement>} variant="outline">
            <span className="truncate">{projectTitle ?? "Sem projeto"}</span>
          </Badge>
        )}
      </OverflowTooltip>
    )}
  </div>
);
