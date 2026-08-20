import type { DocumentSummary } from "@lazuli/shared";
import { FileTextIcon } from "lucide-react";
import { Link } from "react-router";

import type { ViewMode } from "@/features/projects/components/view-mode-toggle.tsx";
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
            className="group flex min-h-36 flex-col justify-between border bg-card p-4 transition-[border-color,box-shadow] hover:border-foreground/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            key={document.id}
            to={`/documents/${projectId}/document/${document.id}`}
          >
            <div>
              <span className="mb-4 grid size-9 place-items-center border text-muted-foreground">
                <FileTextIcon aria-hidden="true" className="size-4" />
              </span>
              <span className="line-clamp-2 font-heading text-xl leading-tight font-medium [overflow-wrap:anywhere] group-hover:underline">
                {document.title}
              </span>
            </div>
            <time className="mt-4 text-xs text-muted-foreground" dateTime={document.updatedAt}>
              Atualizado em {formatProjectDate(document.updatedAt)}
            </time>
          </Link>
        ))}
      </div>
    );

  return (
    <div className="mt-5 overflow-hidden border">
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
            <FileTextIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium group-hover:underline">{document.title}</span>
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
