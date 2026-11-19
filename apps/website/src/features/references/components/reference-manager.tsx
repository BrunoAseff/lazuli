import { cn } from "@/lib/utils.ts";
import {
  REFERENCE_MAX_PAGE_SIZE,
  collectDocumentTextBlocks,
  type ReferenceSource,
  type ReferenceTarget,
} from "@lazuli/shared";
import { CheckIcon, FileTextIcon, PencilIcon, PlusIcon } from "@/components/icons.tsx";
import { useMemo, useState, type Ref } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
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
import { useProjectTree, useDocument } from "@/features/documents/api/document-queries.ts";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group.tsx";
import { CreationWorkspace } from "@/features/ai/components/creation-workspace.tsx";
import { documentLocation } from "@/features/documents/document-navigation.ts";
import { useCreateReferences, useReferences } from "../api/reference-queries.ts";
import { ReferenceDeleteButton } from "./reference-delete-button.tsx";
import { ReferenceDocumentRow } from "./reference-document-row.tsx";
import { SourceReading } from "./source-reading.tsx";

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
    pageSize: REFERENCE_MAX_PAGE_SIZE,
    targetId: target.id,
    targetType: target.type,
  });
  const count = references.data?.items.length ?? 0;
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-2 pt-4 pb-2">
      {/* Laid out like the collection field above: label, current state, then the action. */}
      <h3 className="text-sm font-medium" data-field-label>
        {count ? `Fontes · ${count}` : "Fontes"}
      </h3>
      {references.isPending ? (
        <p className="text-sm text-muted-foreground">Carregando fontes…</p>
      ) : count ? (
        // Pulled out by the row's own padding so the file icon lines up with the label above.
        <div className="-mx-3 min-w-0">
          {references.data?.items.slice(0, 2).map((reference) => (
            <ReferenceDocumentRow
              key={reference.id}
              documentTitle={reference.documentTitle}
              projectTitle={reference.projectTitle}
              scope={reference.anchorId ? "selection" : "document"}
              href={documentLocation({
                anchorId: reference.anchorId,
                documentId: reference.documentId,
                projectId: reference.projectId,
                returnTo: returnTo ?? `${location.pathname}${location.search}`,
              })}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum documento conectado.</p>
      )}
      {/* Unsaved material: the reason takes the action's place, where it would be looked for. */}
      {disabled ? (
        <p className="text-xs text-muted-foreground">Salve para conectar documentos.</p>
      ) : (
        <Button
          className="h-auto w-fit px-0 py-0.5 text-muted-foreground hover:bg-transparent hover:text-foreground aria-expanded:bg-transparent"
          onClick={() => (count ? setManagerOpen(true) : setPickerOpen(true))}
          size="xs"
          type="button"
          variant="ghost"
        >
          {count ? (
            <>
              <PencilIcon aria-hidden="true" /> Editar fontes
            </>
          ) : (
            <>
              <PlusIcon aria-hidden="true" /> Conectar documento
            </>
          )}
        </Button>
      )}
      {references.isError && (
        <p className="text-xs text-destructive">Não foi possível carregar as fontes.</p>
      )}
      <Dialog open={managerOpen} onOpenChange={setManagerOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="pr-8">Fontes do material</DialogTitle>
            <DialogDescription>Documentos conectados a este material.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-3 py-3 lazuli-thin-scrollbar">
            {!count && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum documento vinculado.
              </p>
            )}
            <div className="grid gap-1">
              {references.data?.items.map((reference) => (
                <ReferenceDocumentRow
                  documentTitle={reference.documentTitle}
                  href={documentLocation({
                    anchorId: reference.anchorId,
                    documentId: reference.documentId,
                    projectId: reference.projectId,
                    returnTo: returnTo ?? `${location.pathname}${location.search}`,
                  })}
                  key={reference.id}
                  projectTitle={reference.projectTitle}
                  scope={reference.anchorId ? "selection" : "document"}
                  trailing={
                    <ReferenceDeleteButton
                      label={`Desconectar fonte: ${reference.documentTitle}`}
                      referenceId={reference.id}
                    />
                  }
                />
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
              <PlusIcon aria-hidden="true" /> Conectar documento
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
  const [scope, setScope] = useState("document");
  const navigate = useNavigate();
  const location = useLocation();
  const tree = useProjectTree(projectId ?? "", Boolean(projectId && open));
  const preview = useDocument(projectId ?? "", source?.documentId ?? "", open);
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
    setScope("document");
  };
  const save = async () => {
    if (!source) return;
    try {
      await create.mutateAsync({ source, targets: [target] });
      toast.success("Fonte conectada.");
      close();
    } catch {
      toast.error("Não foi possível conectar a fonte.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="pr-8">Conectar uma fonte</DialogTitle>
          <DialogDescription>Escolha o documento relacionado a este material.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-6 lazuli-thin-scrollbar">
          <CreationWorkspace
            sourceControls
            composing
            sourceLabel="Escolher documento"
            destinationLabel="Prévia da fonte"
            source={
              <div className="space-y-5 font-sans text-sm">
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
                    <div className="grid max-h-64 grid-cols-[minmax(0,1fr)] gap-px overflow-y-auto lazuli-thin-scrollbar">
                      {documents.map((document) => {
                        const selected = source?.documentId === document.id;
                        return (
                          <button
                            aria-pressed={selected}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                              // Selection stays neutral: a firmer tone than hover, the check says which one.
                              selected &&
                                "bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] font-medium hover:bg-[color-mix(in_oklab,var(--foreground)_8%,transparent)]",
                            )}
                            key={document.id}
                            onClick={() => setSource({ type: "document", documentId: document.id })}
                            type="button"
                          >
                            <FileTextIcon
                              aria-hidden="true"
                              className="size-4 shrink-0 text-muted-foreground"
                            />
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
                              <CheckIcon
                                aria-hidden="true"
                                className="size-4 shrink-0 text-primary"
                              />
                            )}
                          </button>
                        );
                      })}
                      {!tree.isPending && documents.length === 0 && (
                        <p className="px-3 py-4 text-sm text-muted-foreground">
                          Nenhum documento encontrado.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {/* The decision sits with the choices, not after the whole preview. */}
                {source && (
                  <fieldset className="space-y-2">
                    <legend className="mb-2 text-sm font-medium">O que conectar</legend>
                    <RadioGroup
                      aria-label="O que conectar"
                      value={scope}
                      onValueChange={setScope}
                      className="gap-2"
                    >
                      {[
                        [
                          "document",
                          "Documento inteiro",
                          "O material aponta para o documento todo.",
                        ],
                        [
                          "selection",
                          "Um trecho específico",
                          "Você marca o trecho no documento em seguida.",
                        ],
                      ].map(([value, label, hint]) => (
                        <RadioCard description={hint} key={value} title={label} value={value} />
                      ))}
                    </RadioGroup>
                  </fieldset>
                )}
              </div>
            }
          >
            {!source ? (
              <div className="grid min-h-48 place-items-center text-center text-sm text-muted-foreground">
                <div>
                  <FileTextIcon aria-hidden="true" className="mx-auto mb-3 size-7" />
                  Selecione um documento
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {preview.isPending ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    Carregando fonte…
                  </p>
                ) : preview.isError ? (
                  <div role="alert">
                    <p>Não foi possível carregar a prévia.</p>
                    <Button variant="outline" onClick={() => void preview.refetch()}>
                      Tentar novamente
                    </Button>
                  </div>
                ) : (
                  preview.data && (
                    <div className="source-reading-compact space-y-3">
                      <h3 className="font-sans text-sm font-semibold">{preview.data.item.title}</h3>
                      <SourceReading
                        key={preview.data.item.id}
                        text={collectDocumentTextBlocks(preview.data.content)
                          .map(({ text }) => text)
                          .join("\n\n")}
                      />
                    </div>
                  )
                )}
              </div>
            )}
          </CreationWorkspace>
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-none border-t px-6 py-4 sm:flex-wrap">
          <DialogCancelButton onClick={close}>Cancelar</DialogCancelButton>
          <Button
            pending={create.isPending}
            disabled={!source || !projectId || create.isPending}
            onClick={() => {
              if (!source || !projectId) return;
              if (scope === "selection") {
                void navigate(
                  `/documents/${projectId}/document/${source.documentId}?${new URLSearchParams({
                    referenceTargetType: target.type,
                    referenceTargetId: target.id,
                    referenceReturnTo: returnTo ?? `${location.pathname}${location.search}`,
                  })}`,
                );
              } else void save();
            }}
          >
            {scope === "selection" ? "Escolher trecho no documento" : "Conectar documento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
