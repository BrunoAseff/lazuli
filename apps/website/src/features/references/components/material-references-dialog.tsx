import { REFERENCE_MAX_PAGE_SIZE, type ReferenceTarget } from "@lazuli/shared";
import { FileTextIcon, Link2Icon } from "@/components/icons.tsx";
import type { Ref } from "react";
import { Link, useLocation, useSearchParams } from "react-router";

import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { useReferences } from "../api/reference-queries.ts";
import { documentLocation } from "@/features/documents/document-navigation.ts";
import { SourceReading } from "./source-reading.tsx";
import { ReferenceRowsSkeleton } from "./reference-document-row.tsx";

export const MaterialReferencesButton = ({
  count,
  label = "Ver fontes",
  target,
}: {
  count: number;
  label?: string;
  target: ReferenceTarget;
}) => {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const referenceKey = `${target.type}:${target.id}`;
  const open = params.get("reference") === referenceKey;
  const setOpen = (next: boolean) => {
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next) updated.set("reference", referenceKey);
        else if (updated.get("reference") === referenceKey) updated.delete("reference");
        return updated;
      },
      { replace: true },
    );
  };
  const references = useReferences(
    {
      page: 1,
      pageSize: REFERENCE_MAX_PAGE_SIZE,
      targetId: target.id,
      targetType: target.type,
    },
    open,
  );
  if (!count) return null;
  return (
    <>
      <Button aria-label={`${label} (${count})`} onClick={() => setOpen(true)} variant="outline">
        <Link2Icon aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{count === 1 ? "Fonte" : "Fontes"}</span>
        <span className="text-muted-foreground tabular-nums">{count}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="px-6 py-5">
            <DialogTitle className="pr-8">Fontes deste material</DialogTitle>
            <DialogDescription>
              Consulte as fontes sem sair da revisão ou abra o documento completo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 content-start gap-6 overflow-y-auto px-6 py-5 lazuli-thin-scrollbar">
            {references.isPending && <ReferenceRowsSkeleton rows={2} />}
            {references.data?.items.map((reference) => (
              <article className="flex min-w-0 gap-3" key={reference.id}>
                <FileTextIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                />
                <div className="min-w-0 flex-1">
                  <OverflowTooltip text={reference.documentTitle}>
                    {(ref) => (
                      <h3 className="truncate font-medium" ref={ref as Ref<HTMLHeadingElement>}>
                        {reference.documentTitle}
                      </h3>
                    )}
                  </OverflowTooltip>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {reference.projectTitle} ·{" "}
                    {reference.anchorId ? "Trecho conectado" : "Documento inteiro"}
                  </p>
                  {reference.sourcePreview && (
                    <blockquote className="source-excerpt mt-3">
                      <SourceReading
                        text={reference.sourcePreview}
                        label="Trecho da fonte"
                        expandLabel="Expandir trecho"
                      />
                    </blockquote>
                  )}
                  <Button asChild className="mt-3" size="sm" variant="outline">
                    <Link
                      to={documentLocation({
                        anchorId: reference.anchorId,
                        documentId: reference.documentId,
                        projectId: reference.projectId,
                        returnTo: `${location.pathname}${location.search}`,
                      })}
                    >
                      Ver no documento
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
            {references.isError && (
              <div className="py-6">
                <p role="alert" className="text-sm text-destructive">
                  Não foi possível carregar as fontes.
                </p>
                <Button
                  className="mt-3"
                  variant="outline"
                  onClick={() => void references.refetch()}
                >
                  Tentar novamente
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
