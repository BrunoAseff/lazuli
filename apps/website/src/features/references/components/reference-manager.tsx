import { REFERENCE_PAGE_SIZE, type ReferenceSource, type ReferenceTarget } from "@lazuli/shared";
import { CheckIcon, FileTextIcon, Link2Icon, LoaderCircleIcon, PlusIcon } from "lucide-react";
import { useMemo, useState, type Ref } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import { HighlightText } from "@/components/highlight-text.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { ProjectFilter } from "@/components/project-filter.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { useProjectTree } from "@/features/documents/api/document-queries.ts";
import { documentLocation } from "@/features/documents/document-navigation.ts";
import { useCreateReferences, useReferences } from "../api/reference-queries.ts";
import { ReferenceDeleteButton } from "./reference-delete-button.tsx";

export const ReferenceManager = ({
  disabled = false,
  returnTo,
  target,
}: {
  disabled?: boolean;
  returnTo?: string;
  target: ReferenceTarget;
}) => {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const managerKey = `${target.type}:${target.id}`;
  const managerOpen = params.get("references") === managerKey;
  const setManagerOpen = (next: boolean) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next) updated.set("references", managerKey);
        else if (updated.get("references") === managerKey) updated.delete("references");
        return updated;
      },
      { replace: true },
    );
  const [pickerOpen, setPickerOpen] = useState(false);
  const references = useReferences({
    page: 1,
    pageSize: REFERENCE_PAGE_SIZE,
    targetId: target.id,
    targetType: target.type,
  });
  const count = references.data?.pagination.totalItems ?? 0;
  return (
    <section className="border-t pt-3">
      <div className="flex min-h-8 items-center gap-2 text-xs text-muted-foreground">
        <Link2Icon aria-hidden="true" className="size-3.5 text-primary" />
        <span className="flex-1">
          {references.isPending
            ? "Carregando referências…"
            : count
              ? `${count} ${count === 1 ? "referência" : "referências"}`
              : "Sem referências"}
        </span>
        <Button
          disabled={disabled}
          onClick={() => setManagerOpen(true)}
          size="xs"
          type="button"
          variant="ghost"
        >
          {count ? "Gerenciar" : "Adicionar"}
        </Button>
      </div>
      {references.isError && (
        <p className="mt-1 text-xs text-destructive">Não foi possível carregar as referências.</p>
      )}
      {disabled && (
        <p className="mt-1 text-xs text-muted-foreground">Salve as alterações para gerenciar.</p>
      )}
      <Dialog open={managerOpen} onOpenChange={setManagerOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="pr-8 text-xl">Referências</DialogTitle>
            <DialogDescription>Documentos conectados a este material.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-6 py-3 lazuli-thin-scrollbar">
            {!count && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum documento vinculado.
              </p>
            )}
            <div className="divide-y">
              {references.data?.items.map((reference) => (
                <div className="flex min-w-0 items-center gap-3 py-3" key={reference.id}>
                  <FileTextIcon aria-hidden="true" className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <OverflowTooltip text={reference.documentTitle}>
                      {(ref) => (
                        <Link
                          className="block truncate text-sm font-medium underline underline-offset-4"
                          ref={ref as Ref<HTMLAnchorElement>}
                          to={documentLocation({
                            anchorId: reference.anchorId,
                            documentId: reference.documentId,
                            projectId: reference.projectId,
                            returnTo: returnTo ?? `${location.pathname}${location.search}`,
                          })}
                        >
                          {reference.documentTitle}
                        </Link>
                      )}
                    </OverflowTooltip>
                    <p className="truncate text-xs text-muted-foreground">
                      {reference.projectTitle} ·{" "}
                      {reference.anchorId ? "Trecho" : "Documento inteiro"}
                    </p>
                  </div>
                  <ReferenceDeleteButton
                    label={`Remover referência de ${reference.documentTitle}`}
                    referenceId={reference.id}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-none border-t px-6 py-4">
            <DialogCancelButton onClick={() => setManagerOpen(false)}>Fechar</DialogCancelButton>
            <Button
              onClick={() => {
                setManagerOpen(false);
                setPickerOpen(true);
              }}
            >
              <PlusIcon aria-hidden="true" /> Adicionar referência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReferenceSourcePickerDialog
        onOpenChange={setPickerOpen}
        open={pickerOpen && !disabled}
        returnTo={returnTo}
        target={target}
      />
    </section>
  );
};

const ReferenceSourcePickerDialog = ({
  onOpenChange,
  open,
  returnTo,
  target,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  returnTo?: string;
  target: ReferenceTarget;
}) => {
  const [projectId, setProjectId] = useState<string>();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<ReferenceSource>();
  const navigate = useNavigate();
  const location = useLocation();
  const tree = useProjectTree(projectId ?? "", Boolean(projectId && open));
  const create = useCreateReferences();
  const documents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return (tree.data?.items ?? []).filter(
      (item) =>
        item.type === "document" &&
        (!normalized || item.title.toLocaleLowerCase("pt-BR").includes(normalized)),
    );
  }, [query, tree.data?.items]);

  const close = () => {
    onOpenChange(false);
    setProjectId(undefined);
    setQuery("");
    setSource(undefined);
  };
  const save = async () => {
    if (!source) return;
    try {
      await create.mutateAsync({ source, targets: [target] });
      toast.success("Referência adicionada.");
      close();
    } catch {
      toast.error("Não foi possível adicionar a referência.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="pr-8 text-xl">Adicionar referência</DialogTitle>
          <DialogDescription>Escolha o documento relacionado a este material.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-6 lazuli-thin-scrollbar">
          <div className="space-y-2">
            <label className="text-sm font-medium">Projeto</label>
            <ProjectFilter
              allowAll={false}
              allowNone={false}
              fullWidth
              label="Selecionar projeto"
              onChange={(value) => {
                setProjectId(value === "none" ? undefined : value);
                setSource(undefined);
              }}
              value={projectId}
            />
          </div>
          {projectId && (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="reference-document-search">
                Documento
              </label>
              <Input
                id="reference-document-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Pesquisar documentos"
                value={query}
              />
              <div className="max-h-64 divide-y overflow-y-auto border-y lazuli-thin-scrollbar">
                {documents.map((document) => {
                  const selected = source?.documentId === document.id;
                  return (
                    <button
                      className={`flex w-full items-center gap-2 px-2 py-3 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-muted" : ""}`}
                      key={document.id}
                      onClick={() => setSource({ type: "document", documentId: document.id })}
                      type="button"
                    >
                      <FileTextIcon aria-hidden="true" className="size-4 shrink-0 text-primary" />
                      <OverflowTooltip text={document.title}>
                        {(ref) => (
                          <span
                            className="min-w-0 flex-1 truncate"
                            ref={ref as Ref<HTMLSpanElement>}
                          >
                            <HighlightText query={query} text={document.title} />
                          </span>
                        )}
                      </OverflowTooltip>
                      {selected && (
                        <CheckIcon aria-hidden="true" className="size-4 shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })}
                {!tree.isPending && documents.length === 0 && (
                  <p className="px-2 py-4 text-sm text-muted-foreground">
                    Nenhum documento encontrado.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-none border-t px-6 py-4 sm:flex-wrap">
          <DialogCancelButton onClick={close}>Cancelar</DialogCancelButton>
          {source && projectId && (
            <Button
              onClick={() =>
                navigate(
                  `/documents/${projectId}/document/${source.documentId}?${new URLSearchParams({
                    referenceTargetType: target.type,
                    referenceTargetId: target.id,
                    referenceReturnTo: returnTo ?? `${location.pathname}${location.search}`,
                  })}`,
                )
              }
              variant="outline"
            >
              Escolher um trecho
            </Button>
          )}
          <Button disabled={!source || create.isPending} onClick={() => void save()}>
            {create.isPending && <LoaderCircleIcon aria-hidden="true" className="animate-spin" />}
            Vincular documento inteiro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
