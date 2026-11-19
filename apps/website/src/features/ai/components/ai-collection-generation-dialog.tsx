import {
  AI_DOCUMENT_MAX_BLOCKS,
  AI_DOCUMENT_MAX_TEXT_LENGTH,
  AI_COLLECTION_MAX_ITEMS,
  AI_CREDITS_PER_ITEM,
  collectDocumentTextBlocks,
  getDocumentBlockText,
  PROJECT_MAX_PAGE_SIZE,
  type AiCollectionDraft,
  type AiMaterialKind,
  type DocumentBlock,
} from "@lazuli/shared";
import { CircleNotchIcon } from "@/components/icons.tsx";
import { AiCreditCost } from "./ai-credit-cost.tsx";
import { CreationWorkspace } from "./creation-workspace.tsx";
import { SourceReading } from "@/features/references/components/source-reading.tsx";
import { QuantitySelector } from "@/components/quantity-selector.tsx";
import { MagicWandIcon, PlusIcon, Trash2Icon } from "@/components/icons.tsx";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { ConfirmationDialog } from "@/components/confirmation-dialog.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import { useDocument, useProjectTree } from "@/features/documents/api/document-queries.ts";
import { CreditUpgradeGuard } from "@/features/billing/components/credit-upgrade-guard.tsx";
import { useProjects } from "@/features/projects/api/project-queries.ts";
import { hasDuplicateQuizOptionTexts } from "@/features/quizzes/components/quiz-alternatives-field.tsx";
import { studyItemAgreement, studyItemCount } from "@/lib/text.ts";
import { getApiErrorMessage } from "@/lib/api-client.ts";
import { AutoHeight } from "@/components/auto-height.tsx";
import { GemLoader } from "@/components/brand-mark.tsx";
import { MorphText } from "@/components/motion/morph-text.tsx";
import { cn } from "@/lib/utils.ts";
import {
  clearAiReviewSession,
  readAiReviewSession,
  writeAiReviewSession,
} from "../ai-review-session.ts";
import type { AiEditableQuizProposal } from "./ai-quiz-proposal-editor.tsx";
import { AiProposalReviewList } from "./ai-proposal-review-list.tsx";
import {
  useAiCollectionGeneration,
  useAiCreditBalance,
  useApproveAiGeneration,
  useCreateAiCollectionGeneration,
  useDiscardAiCollectionGeneration,
  useLatestAiCollectionGeneration,
} from "../api/ai-queries.ts";

type EditableFlashcard = AiCollectionDraft["flashcards"][number] & { selected: boolean };
type EditableQuiz = AiCollectionDraft["quizQuestions"][number] &
  AiEditableQuizProposal & { selected: boolean };

const textContent = (text: string): DocumentBlock[] => [
  {
    id: crypto.randomUUID(),
    type: "paragraph",
    content: [{ type: "text", text: text.trim(), styles: {} }],
  },
];

const sectionOptions = (content: DocumentBlock[]) =>
  content.flatMap((block, index) => {
    if (block.type !== "heading") return [];
    const level = Number((block.props as { level?: unknown } | undefined)?.level ?? 1);
    const ids = [block.id];
    for (let cursor = index + 1; cursor < content.length; cursor += 1) {
      const candidate = content[cursor]!;
      if (
        candidate.type === "heading" &&
        Number((candidate.props as { level?: unknown } | undefined)?.level ?? 1) <= level
      )
        break;
      ids.push(candidate.id);
    }
    return [{ id: block.id, ids, title: getDocumentBlockText(block) || "Seção sem título" }];
  });

export const AiCollectionGenerationDialog = ({
  collectionId,
  defaultProjectId,
  kind,
  onOpenChange,
  open,
}: {
  collectionId: string;
  /** The collection's own project is the likely source: start there instead of an empty choice. */
  defaultProjectId?: string | null;
  kind: AiMaterialKind;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const fieldsId = useId();
  const [projectId, setProjectId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [sectionId, setSectionId] = useState("document");
  const [quantity, setQuantity] = useState(5);
  const [guidance, setGuidance] = useState("");
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [operationId, setOperationId] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [draft, setDraft] = useState<AiCollectionDraft | null>(null);
  const [flashcards, setFlashcards] = useState<EditableFlashcard[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<EditableQuiz[]>([]);
  const location = useLocation();
  const appliedOperationId = useRef("");
  const projects = useProjects(
    { page: 1, pageSize: PROJECT_MAX_PAGE_SIZE, query: "" },
    open && !draft,
  );
  const tree = useProjectTree(projectId, open && Boolean(projectId) && !draft);
  const document = useDocument(projectId, documentId, open && Boolean(documentId) && !draft);
  const balance = useAiCreditBalance();
  const latest = useLatestAiCollectionGeneration(collectionId, open && !operationId);
  const generation = useAiCollectionGeneration(operationId);
  const create = useCreateAiCollectionGeneration(collectionId);
  const discard = useDiscardAiCollectionGeneration(collectionId);
  const approve = useApproveAiGeneration(operationId || draft?.operationId || "");
  const documents = (tree.data?.items ?? []).filter((item) => item.type === "document");
  const sections = useMemo(
    () => sectionOptions((document.data?.content ?? []) as DocumentBlock[]),
    [document.data?.content],
  );
  const documentTextBlocks = useMemo(
    () => collectDocumentTextBlocks((document.data?.content ?? []) as DocumentBlock[]),
    [document.data?.content],
  );
  const wholeDocumentEligible =
    documentTextBlocks.length > 0 &&
    documentTextBlocks.length <= AI_DOCUMENT_MAX_BLOCKS &&
    documentTextBlocks.map(({ text }) => text).join(" ").length <= AI_DOCUMENT_MAX_TEXT_LENGTH;
  const selectedSection = sections.find(({ id }) => id === sectionId);
  const selectedSectionEligible = useMemo(() => {
    if (!selectedSection) return false;
    const ids = new Set(selectedSection.ids);
    const blocks = documentTextBlocks.filter(({ id }) => ids.has(id));
    return (
      blocks.length > 0 &&
      blocks.length <= AI_DOCUMENT_MAX_BLOCKS &&
      blocks.map(({ text }) => text).join(" ").length <= AI_DOCUMENT_MAX_TEXT_LENGTH
    );
  }, [documentTextBlocks, selectedSection]);
  const result = operationId ? generation.data : latest.data;
  const queryError = operationId ? generation.error : latest.error;
  const busy = !queryError && (result?.status === "queued" || result?.status === "processing");
  const selectedCount =
    kind === "flashcard"
      ? flashcards.filter(({ selected }) => selected).length
      : quizQuestions.filter(({ selected }) => selected).length;
  const cost = quantity * AI_CREDITS_PER_ITEM;
  const persistReview = () => {
    if (!draft?.projectId) return;
    writeAiReviewSession(draft.operationId, {
      flashcards,
      quizQuestions,
      source: {
        documentId: draft.documentId,
        documentTitle: draft.documentTitle,
        projectId: draft.projectId,
        projectTitle: draft.projectTitle,
      },
    });
  };

  useEffect(() => {
    if (!open || result?.status !== "completed") return;
    if (appliedOperationId.current === result.draft.operationId) return;
    appliedOperationId.current = result.draft.operationId;
    setDraft(result.draft);
    setOperationId(result.draft.operationId);
    const saved = readAiReviewSession(result.draft.operationId);
    setFlashcards(
      saved?.flashcards ?? result.draft.flashcards.map((item) => ({ ...item, selected: true })),
    );
    setQuizQuestions(
      saved?.quizQuestions ??
        result.draft.quizQuestions.map((item) => ({ ...item, selected: true })),
    );
  }, [open, result]);

  useEffect(() => {
    if (!draft || !draft.projectId) return;
    persistReview();
  }, [draft, flashcards, quizQuestions]);

  useEffect(() => {
    if (open && !projectId && defaultProjectId) setProjectId(defaultProjectId);
  }, [defaultProjectId, open, projectId]);

  useEffect(() => {
    if (!projectId) {
      setDocumentId("");
      setSectionId("document");
    }
  }, [projectId]);

  useEffect(() => setSectionId("document"), [documentId]);

  useEffect(() => {
    if (!document.data || wholeDocumentEligible) return;
    if (!sections.some(({ id }) => id === sectionId)) setSectionId(sections[0]?.id ?? "");
  }, [document.data, sectionId, sections, wholeDocumentEligible]);

  const requestGeneration = async () => {
    if (!document.data) return;
    try {
      const response = await create.mutateAsync({
        idempotencyKey: crypto.randomUUID(),
        documentId,
        expectedRevision: document.data.revision,
        kind,
        collectionId,
        quantity,
        guidance,
        sourceBlockIds: wholeDocumentEligible ? [] : (selectedSection?.ids ?? []),
      });
      if (response.status === "completed") {
        setDraft(response.draft);
        setOperationId(response.draft.operationId);
      } else if (response.status !== "none") setOperationId(response.operationId);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível iniciar a geração."));
    }
  };

  const changeProject = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    setDocumentId("");
    setSectionId("document");
  };

  const save = async () => {
    if (!draft || !selectedCount) return;
    try {
      const saved = await approve.mutateAsync({
        expectedRevision: draft.documentRevision,
        flashcards:
          kind === "flashcard"
            ? flashcards
                .filter(({ selected }) => selected)
                .map(({ answer, id, question, references }) => ({
                  id,
                  question: textContent(question),
                  answer: textContent(answer),
                  references: references.filter(
                    ({ quote, scope }) => scope === "document" || quote.trim(),
                  ),
                }))
            : [],
        quizQuestions:
          kind === "quizQuestion"
            ? quizQuestions
                .filter(({ selected }) => selected)
                .map(({ content, correctOptionIndex, id, options, prompt, references }) => ({
                  id,
                  content: content ?? textContent(prompt),
                  options: options.map((text, index) => ({
                    id: crypto.randomUUID(),
                    text,
                    isCorrect: index === correctOptionIndex,
                  })),
                  references: references.filter(
                    ({ quote, scope }) => scope === "document" || quote.trim(),
                  ),
                }))
            : [],
      });
      toast.success(
        `${studyItemCount(kind, saved.createdIds.length)} ${studyItemAgreement(kind, saved.createdIds.length, "adicionad")} à coleção.`,
      );
      clearAiReviewSession(draft.operationId);
      appliedOperationId.current = "";
      setDraft(null);
      setOperationId("");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível salvar os materiais."));
    }
  };

  const discardDraft = async () => {
    if (!draft) return false;
    try {
      await discard.mutateAsync(draft.operationId);
      clearAiReviewSession(draft.operationId);
      appliedOperationId.current = "";
      setDraft(null);
      setOperationId("");
      setFlashcards([]);
      setQuizQuestions([]);
      setDiscardOpen(false);
      onOpenChange(false);
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível descartar este rascunho."));
      return false;
    }
  };

  const invalid =
    flashcards.some(({ answer, question, selected }) =>
      selected ? !answer.trim() || !question.trim() : false,
    ) ||
    quizQuestions.some(({ correctOptionIndex, options, prompt, selected }) =>
      selected
        ? !prompt.trim() ||
          correctOptionIndex < 0 ||
          options.some((option) => !option.trim()) ||
          hasDuplicateQuizOptionTexts(options)
        : false,
    );
  const reviewReturnTo = draft
    ? `${location.pathname}?${new URLSearchParams({ aiGeneration: draft.operationId })}`
    : `${location.pathname}${location.search}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0",
          // Preparing is a short form in one column; reviewing needs the source beside it.
          draft ? "sm:max-w-5xl" : "sm:max-w-lg",
        )}
      >
        <DialogHeader className={draft ? "border-b px-6 py-5" : "px-6 pt-6"}>
          <DialogTitle>
            {draft
              ? "Revisar propostas"
              : kind === "flashcard"
                ? "Criar flashcards com IA"
                : "Criar questões com IA"}
          </DialogTitle>
          <DialogDescription>
            {draft
              ? "Ajuste o texto, desligue o que não quer salvar ou descarte. Só o que estiver ligado entra na coleção."
              : "Você revisa as propostas antes de salvar. A geração continua mesmo se você sair desta página."}
          </DialogDescription>
        </DialogHeader>
        <div
          className={cn(
            "min-h-0 overflow-y-auto lazuli-thin-scrollbar",
            draft ? "px-6 py-5 md:overflow-hidden" : "px-6 pt-5 pb-6",
          )}
        >
          {draft ? (
            <CreationWorkspace
              reviewing
              source={
                <div>
                  <h3>{draft.documentTitle}</h3>
                  <SourceReading key={draft.documentId} text={draft.sourceText} />
                </div>
              }
            >
              <AiProposalReviewList
                flashcards={flashcards}
                onFlashcardChange={(id, change) =>
                  setFlashcards((items) =>
                    items.map((item) => (item.id === id ? { ...item, ...change } : item)),
                  )
                }
                onNavigateReference={persistReview}
                onQuizChange={(id, change) =>
                  setQuizQuestions((items) =>
                    items.map((item) => (item.id === id ? { ...item, ...change } : item)),
                  )
                }
                onRemove={(id, kind) => {
                  // Removing the last proposal leaves nothing to review: discard the draft and close,
                  // instead of an empty review that offers to "save 0".
                  if (flashcards.length + quizQuestions.length <= 1) {
                    void discardDraft().then(
                      (done) => done && toast.success("Propostas descartadas."),
                    );
                    return;
                  }
                  if (kind === "flashcard")
                    setFlashcards((items) => items.filter((item) => item.id !== id));
                  else setQuizQuestions((items) => items.filter((item) => item.id !== id));
                }}
                operationId={draft.operationId}
                quizQuestions={quizQuestions}
                returnTo={reviewReturnTo}
                source={{
                  documentId: draft.documentId,
                  documentTitle: draft.documentTitle,
                  projectId: draft.projectId ?? "",
                  projectTitle: draft.projectTitle,
                }}
              />
            </CreationWorkspace>
          ) : queryError ? (
            <div className="grid min-h-72 place-items-center text-center">
              <div className="max-w-sm">
                <p className="font-medium">Não foi possível concluir esta geração</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getApiErrorMessage(queryError, "Tente iniciar uma nova geração.")}
                </p>
              </div>
            </div>
          ) : busy ? (
            <GenerationPending />
          ) : (
            <div className="grid gap-5">
              {/* Fields that appear on choice (a section for large documents) open smoothly. */}
              <AutoHeight className="-m-1">
                <div className="grid gap-5 p-1 text-sm">
                  <div className="grid gap-2">
                    <Label htmlFor={`${fieldsId}-project`}>Projeto</Label>
                    <Select value={projectId} onValueChange={changeProject}>
                      <SelectTrigger
                        id={`${fieldsId}-project`}
                        className="w-full"
                        title={projects.data?.items.find((item) => item.id === projectId)?.title}
                      >
                        <SelectValue placeholder="Selecione um projeto" />
                      </SelectTrigger>
                      <SelectContent className={fieldListClass}>
                        {projects.data?.items.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`${fieldsId}-document`}>Documento</Label>
                    {/* A project with no documents says so instead of opening an empty list. */}
                    <Select
                      disabled={!projectId || (tree.isSuccess && documents.length === 0)}
                      value={documentId}
                      onValueChange={setDocumentId}
                    >
                      <SelectTrigger
                        id={`${fieldsId}-document`}
                        className="w-full"
                        title={documents.find((item) => item.id === documentId)?.title}
                      >
                        <SelectValue
                          placeholder={
                            tree.isSuccess && documents.length === 0
                              ? "Este projeto ainda não tem documentos"
                              : "Selecione um documento"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className={fieldListClass}>
                        {documents.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {document.data && !wholeDocumentEligible && (
                    <div className="grid gap-2">
                      <Label htmlFor={`${fieldsId}-section`}>Seção</Label>
                      {sections.length ? (
                        <>
                          <Select value={sectionId} onValueChange={setSectionId}>
                            <SelectTrigger id={`${fieldsId}-section`} className="w-full">
                              <SelectValue placeholder="Selecione uma seção" />
                            </SelectTrigger>
                            <SelectContent className={fieldListClass}>
                              {sections.map((section) => (
                                <SelectItem key={section.id} value={section.id}>
                                  {section.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            O documento é grande demais para uma única geração. Escolha uma seção.
                          </p>
                          {selectedSection && !selectedSectionEligible && (
                            <p className="text-xs text-destructive">
                              Esta seção ainda é muito extensa. Escolha uma seção menor.
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-destructive">
                          Este documento é grande demais e não possui seções reconhecidas. Divida-o
                          com títulos antes de gerar materiais.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </AutoHeight>
              <div className="grid gap-5">
                <div className="grid gap-2">
                  <Label>{kind === "flashcard" ? "Quantos?" : "Quantas?"}</Label>
                  <QuantitySelector
                    label="Quantidade de propostas"
                    value={quantity}
                    options={[1, 3, 5, 8, AI_COLLECTION_MAX_ITEMS]}
                    onChange={setQuantity}
                  />
                </div>
                {/* Optional guidance stays out of the way until wanted. */}
                {guidanceOpen || guidance ? (
                  <div className="grid gap-2">
                    <Label htmlFor="collection-ai-guidance">
                      Orientação para a IA{" "}
                      <span className="font-normal text-muted-foreground">Opcional</span>
                    </Label>
                    <Textarea
                      autoFocus={guidanceOpen && !guidance}
                      id="collection-ai-guidance"
                      maxLength={500}
                      onChange={(event) => setGuidance(event.target.value)}
                      placeholder="Ex.: priorize conceitos centrais e varie o nível das perguntas."
                      rows={3}
                      value={guidance}
                    />
                  </div>
                ) : (
                  <Button
                    className="h-auto w-fit px-0 py-0.5 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    onClick={() => setGuidanceOpen(true)}
                    size="xs"
                    type="button"
                    variant="ghost"
                  >
                    <PlusIcon aria-hidden="true" /> Adicionar orientação para a IA
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="m-0 flex-col rounded-none border-t px-6 py-4 sm:items-center">
          {!draft && (
            <div className="w-full sm:mr-auto sm:w-auto">
              <AiCreditCost cost={cost} available={balance.data?.available} />
            </div>
          )}
          {draft && (
            <Button
              className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
              onClick={() => setDiscardOpen(true)}
              variant="ghost"
            >
              <Trash2Icon /> Descartar propostas
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
            Fechar
          </Button>
          {draft ? (
            <Button
              disabled={!selectedCount || invalid || approve.isPending}
              onClick={() => void save()}
            >
              Salvar {studyItemCount(kind, selectedCount)}
            </Button>
          ) : queryError ? (
            <Button onClick={() => setOperationId("")} variant="outline">
              Tentar novamente
            </Button>
          ) : (
            !busy && (
              <CreditUpgradeGuard available={balance.data?.available} cost={cost}>
                <Button
                  disabled={
                    !document.data ||
                    (!wholeDocumentEligible && !selectedSectionEligible) ||
                    create.isPending ||
                    (balance.data?.available ?? 0) < cost
                  }
                  onClick={() => void requestGeneration()}
                >
                  <MagicWandIcon /> Gerar propostas
                </Button>
              </CreditUpgradeGuard>
            )
          )}
        </DialogFooter>
      </DialogContent>
      <ConfirmationDialog
        actionLabel="Descartar"
        description="As propostas serão removidas. Os créditos já consumidos pela geração não serão devolvidos."
        destructive
        disabled={discard.isPending}
        onConfirm={async () => void (await discardDraft())}
        onOpenChange={setDiscardOpen}
        open={discardOpen}
        title="Descartar propostas geradas?"
      />
    </Dialog>
  );
};

export const AiCollectionGenerationAction = ({
  className,
  collectionId,
  defaultProjectId,
  disabled = false,
  iconOnly = false,
  kind,
}: {
  className?: string;
  collectionId: string;
  defaultProjectId?: string | null;
  disabled?: boolean;
  iconOnly?: boolean;
  kind: AiMaterialKind;
}) => {
  const [open, setOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const requestedOperationId = params.get("aiGeneration");
  const latest = useLatestAiCollectionGeneration(collectionId, !disabled);
  const busy = latest.data?.status === "queued" || latest.data?.status === "processing";
  const ready = latest.data?.status === "completed";
  const material = kind === "flashcard" ? "flashcards" : "questões";
  const label = busy ? "Gerando…" : ready ? "Revisar propostas" : "Gerar com IA";
  useEffect(() => {
    if (requestedOperationId) setOpen(true);
  }, [requestedOperationId]);
  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && requestedOperationId)
      setParams(
        (current) => {
          const updated = new URLSearchParams(current);
          updated.delete("aiGeneration");
          return updated;
        },
        { replace: true },
      );
  };
  const trigger = (
    <Button
      aria-label={
        ready
          ? `Revisar ${material} ${kind === "flashcard" ? "gerados" : "geradas"} por IA`
          : `Gerar ${material} com IA`
      }
      className={cn("relative", className)}
      // Other surfaces (an empty collection's guide) open the same dialog through this button.
      data-ai-generation-trigger
      disabled={disabled}
      onClick={() => setOpen(true)}
      size={iconOnly ? "icon" : "sm"}
      variant="outline"
    >
      {busy ? <CircleNotchIcon className="animate-spin" /> : <MagicWandIcon />}
      {!iconOnly && <MorphText text={label} />}
      {/* Proposals waiting for review must be visible even when the action is only an icon. */}
      {ready && iconOnly && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-card"
        />
      )}
    </Button>
  );

  return (
    <>
      {iconOnly ? (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        trigger
      )}
      <AiCollectionGenerationDialog
        collectionId={collectionId}
        defaultProjectId={defaultProjectId}
        kind={kind}
        onOpenChange={changeOpen}
        open={open}
      />
    </>
  );
};

/** A source list stays within its field's column; long titles wrap instead of spilling over. */
const fieldListClass = "min-w-0 [&_[data-slot=select-item]_span]:whitespace-normal";

/**
 * While the material is cut into proposals: the gem catches light and the proposals take shape as
 * outlines, so the wait shows what is coming instead of a spinner.
 */
export const GenerationPending = () => (
  <div
    className="grid min-h-72 content-center justify-items-center gap-8 text-center"
    role="status"
  >
    <div>
      <GemLoader className="mx-auto mb-4" size={32} />
      <p className="font-medium">Gerando propostas…</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Você pode fechar esta janela e voltar depois.
      </p>
    </div>
    <div aria-hidden="true" className="grid w-full max-w-md gap-2">
      {[0.92, 0.74, 0.84].map((width, index) => (
        <div
          className="generation-ghost rounded-[var(--radius)] border border-border bg-card px-4 py-3"
          key={index}
          style={{ animationDelay: `${index * 180}ms` }}
        >
          <span
            className="block h-2.5 rounded-full bg-muted"
            style={{ width: `${width * 100}%` }}
          />
          <span className="mt-2 block h-2.5 w-1/2 rounded-full bg-muted" />
        </div>
      ))}
    </div>
  </div>
);
