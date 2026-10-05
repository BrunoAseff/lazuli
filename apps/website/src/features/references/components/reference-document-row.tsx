import { FileTextIcon } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { Link } from "react-router";

import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";

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
  <div className="flex min-w-0 items-center gap-3 py-3">
    <FileTextIcon aria-hidden="true" className="size-4 shrink-0 text-primary" />
    <div className="min-w-0 flex-1">
      <OverflowTooltip text={documentTitle}>
        {(ref) => (
          <Link
            className="block truncate text-sm font-medium underline underline-offset-4"
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
    {trailing}
  </div>
);
