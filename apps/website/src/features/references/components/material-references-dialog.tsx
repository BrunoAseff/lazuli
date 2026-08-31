import { REFERENCE_MAX_PAGE_SIZE, type ReferenceTarget } from "@lazuli/shared";
import { FileTextIcon, Link2Icon, LoaderCircleIcon } from "lucide-react";
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

export const MaterialReferencesButton = ({
  count,
  label = "Ver referências",
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
      <Button onClick={() => setOpen(true)} size="sm" variant="outline">
        <Link2Icon aria-hidden="true" className="size-4 text-primary" />
        {label} ({count})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="pr-8 text-xl">Referências deste material</DialogTitle>
            <DialogDescription>
              Consulte as fontes sem sair da revisão ou abra o documento completo.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 divide-y overflow-y-auto px-6 py-3 lazuli-thin-scrollbar">
            {references.isPending && (
              <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" /> Carregando…
              </p>
            )}
            {references.data?.items.map((reference) => (
              <article className="flex min-w-0 gap-3 py-4" key={reference.id}>
                <FileTextIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
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
                    {reference.anchorId ? "Trecho vinculado" : "Documento inteiro"}
                  </p>
                  {reference.sourcePreview && (
                    <blockquote className="mt-3 border-l-2 border-primary/50 pl-3 text-sm leading-relaxed text-muted-foreground">
                      {reference.sourcePreview}
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
                      Abrir no documento
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
            {references.isError && (
              <p className="py-6 text-sm text-destructive">
                Não foi possível carregar as referências.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
