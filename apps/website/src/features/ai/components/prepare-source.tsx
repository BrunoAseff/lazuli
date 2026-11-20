import type { ReactNode } from "react";

import { DocumentDomainIcon } from "@/components/domain-icons.ts";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";

/**
 * The source while preparing a generation, in one line or a short excerpt. A whole document is
 * named, not shown: its text opens only on request. A selection is short, so it is the source
 * itself; an image is shown small.
 */
export const PrepareSource = ({
  children,
  documentTitle,
  expanded,
  onToggle,
  scope,
}: {
  children: ReactNode;
  documentTitle: string;
  expanded: boolean;
  onToggle: () => void;
  scope: "document" | "selection" | "image";
}) => (
  <div className="grid gap-2">
    <Label asChild>
      <p>Fonte</p>
    </Label>
    {scope === "document" ? (
      <>
        <div className="flex min-w-0 items-center gap-2">
          <DocumentDomainIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="min-w-0 truncate">{documentTitle || "Este documento"}</span>
          <span className="shrink-0 text-muted-foreground">· documento inteiro</span>
          <Button
            aria-expanded={expanded}
            className="ml-auto h-auto shrink-0 px-0 py-0.5 text-muted-foreground hover:bg-transparent hover:text-foreground aria-expanded:bg-transparent"
            onClick={onToggle}
            size="xs"
            type="button"
            variant="ghost"
          >
            {expanded ? "Ocultar texto" : "Ver texto"}
          </Button>
        </div>
        {expanded && (
          <div className="source-excerpt max-h-56 overflow-y-auto font-reading text-[0.9375rem] leading-relaxed lazuli-thin-scrollbar">
            {children}
          </div>
        )}
      </>
    ) : scope === "image" ? (
      <div className="[&_img]:max-h-40">{children}</div>
    ) : (
      <div className="source-excerpt max-h-32 overflow-y-auto font-reading text-[0.9375rem] leading-relaxed lazuli-thin-scrollbar">
        {children}
      </div>
    )}
  </div>
);
