import type { ReactNode, Ref } from "react";
import { Link } from "react-router";

import { HighlightText } from "@/components/highlight-text.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { Badge } from "@/components/ui/badge.tsx";

export const StudyCollectionIdentity = ({
  href,
  icon,
  projectTitle,
  query,
  title,
}: {
  href: string;
  icon: ReactNode;
  projectTitle?: string | null;
  query: string;
  title: string;
}) => (
  <div className="min-w-0">
    <div className="flex items-center gap-2">
      {icon}
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
    <OverflowTooltip text={projectTitle ?? "Sem projeto"}>
      {(ref) => (
        <Badge className="mt-2 max-w-full" ref={ref as Ref<HTMLSpanElement>} variant="outline">
          <span className="truncate">{projectTitle ?? "Sem projeto"}</span>
        </Badge>
      )}
    </OverflowTooltip>
  </div>
);
