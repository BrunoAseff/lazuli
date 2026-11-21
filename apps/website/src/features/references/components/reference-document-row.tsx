import { FileTextIcon } from "@/components/icons.tsx";
import type { ReactNode, Ref } from "react";
import { Link } from "react-router";

import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export const ReferenceDocumentRow = ({
  documentTitle,
  href,
  onNavigate,
  projectTitle,
  scope,
  trailing,
}: {
  documentTitle: string;
  href: string;
  onNavigate?: () => void;
  projectTitle: string;
  scope: "document" | "selection";
  trailing?: ReactNode;
}) => (
  // The whole row opens the source; trailing actions sit above the stretched link. The row keeps its
  // own padding (no negative margin), so it never overflows a scrolling column.
  <div className="group relative flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring/50">
    <FileTextIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    <div className="min-w-0 flex-1">
      <OverflowTooltip text={documentTitle}>
        {(ref) => (
          <Link
            className="block truncate text-[0.9375rem] font-medium underline-offset-4 outline-none group-hover:underline after:absolute after:inset-0 after:rounded-lg"
            onClick={onNavigate}
            ref={ref as Ref<HTMLAnchorElement>}
            to={href}
          >
            {documentTitle}
          </Link>
        )}
      </OverflowTooltip>
      <p className="truncate text-xs text-muted-foreground">
        {projectTitle} · {scope === "selection" ? "Trecho" : "Documento inteiro"}
      </p>
    </div>
    {trailing && <div className="relative z-10">{trailing}</div>}
  </div>
);

/** Rows of the same shape while references load: icon, title and the line under it. */
export const ReferenceRowsSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div aria-label="Carregando" className="grid gap-1" role="status">
    {Array.from({ length: rows }, (_, index) => (
      <div className="flex items-center gap-3 px-3 py-2.5" key={index}>
        <Skeleton className="size-4 shrink-0" />
        <div className="grid flex-1 gap-1.5">
          <Skeleton className="h-3.5 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      </div>
    ))}
  </div>
);
