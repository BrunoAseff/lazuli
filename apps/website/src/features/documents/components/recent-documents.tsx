import type { DocumentSummary } from "@lazuli/shared";
import { Link } from "react-router";

import { DocumentDomainIcon } from "@/components/domain-icons.ts";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import type { ViewMode } from "@/components/view-mode-toggle.tsx";
import { formatProjectDate } from "@/features/projects/format-project-date.ts";

export const RecentDocuments = ({
  items,
  projectId,
  view,
}: {
  items: DocumentSummary[];
  projectId: string;
  view: ViewMode;
}) => {
  if (view === "cards")
    return (
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((document) => (
          <Link
            className="group flex min-h-32 flex-col justify-between rounded-xl border bg-card p-4 transition-colors hover:border-foreground/30 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            key={document.id}
            to={`/documents/${projectId}/document/${document.id}`}
          >
            <div>
              <DocumentDomainIcon
                aria-hidden="true"
                className="mb-4 size-5 text-muted-foreground"
                weight="duotone"
              />
              <OverflowTooltip text={document.title}>
                {(ref) => (
                  <span
                    className="block truncate font-heading text-xl leading-tight group-hover:underline"
                    ref={ref as React.RefObject<HTMLSpanElement>}
                  >
                    {document.title}
                  </span>
                )}
              </OverflowTooltip>
            </div>
            <time className="mt-4 text-xs text-muted-foreground" dateTime={document.updatedAt}>
              Atualizado em {formatProjectDate(document.updatedAt)}
            </time>
          </Link>
        ))}
      </div>
    );

  return (
    <div className="mt-5 overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] border-b bg-muted/35 px-4 py-2 text-xs font-medium text-muted-foreground">
        <span>Documento</span>
        <span className="hidden sm:block">Atualizado em</span>
      </div>
      {items.map((document) => (
        <Link
          className="group grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b px-4 transition-colors last:border-b-0 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40"
          key={document.id}
          to={`/documents/${projectId}/document/${document.id}`}
        >
          <span className="flex min-w-0 items-center gap-3">
            <DocumentDomainIcon
              aria-hidden="true"
              className="size-[1.125rem] shrink-0 text-muted-foreground"
              weight="duotone"
            />
            <OverflowTooltip text={document.title}>
              {(ref) => (
                <span
                  className="truncate font-medium group-hover:underline"
                  ref={ref as React.RefObject<HTMLSpanElement>}
                >
                  {document.title}
                </span>
              )}
            </OverflowTooltip>
          </span>
          <time
            className="hidden text-xs text-muted-foreground sm:block"
            dateTime={document.updatedAt}
          >
            {formatProjectDate(document.updatedAt)}
          </time>
        </Link>
      ))}
    </div>
  );
};
