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
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { CoinsIcon } from "@phosphor-icons/react/Coins";
import { MagicWandIcon } from "@phosphor-icons/react/MagicWand";
import { useEffect, useMemo, useState } from "react";
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
import { useProjects } from "@/features/projects/api/project-queries.ts";
import { hasDuplicateQuizOptionTexts } from "@/features/quizzes/components/quiz-alternatives-field.tsx";
import { getApiErrorMessage } from "@/lib/api-client.ts";
import { cn } from "@/lib/utils.ts";
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
  kind,
  onOpenChange,
  open,
}: {
  collectionId: string;
  kind: AiMaterialKind;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const [projectId, setProjectId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [sectionId, setSectionId] = useState("document");
  const [quantity, setQuantity] = useState(5);
  const [guidance, setGuidance] = useState("");
  const [operationId, setOperationId] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [draft, setDraft] = useState<AiCollectionDraft | null>(null);
  const [flashcards, setFlashcards] = useState<EditableFlashcard[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<EditableQuiz[]>([]);
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

  useEffect(() => {
    if (!open || result?.status !== "completed") return;
    setDraft(result.draft);
    setOperationId(result.draft.operationId);
    setFlashcards(result.draft.flashcards.map((item) => ({ ...item, selected: true })));
    setQuizQuestions(result.draft.quizQuestions.map((item) => ({ ...item, selected: true })));
  }, [open, result]);

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
        sourceBlockIds: selectedSection?.ids ?? [],
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
                .map(({ answer, id, question }) => ({
                  id,
                  question: textContent(question),
                  answer: textContent(answer),
                }))
            : [],
        quizQuestions:
          kind === "quizQuestion"
            ? quizQuestions
                .filter(({ selected }) => selected)
                .map(({ content, correctOptionIndex, id, options, prompt }) => ({
                  id,
                  content: content ?? textContent(prompt),
                  options: options.map((text, index) => ({
                    id: crypto.randomUUID(),
                    text,
                    isCorrect: index === correctOptionIndex,
                  })),
                }))
            : [],
      });
      toast.success(`${saved.createdIds.length} materiais adicionados à coleção.`);
      setDraft(null);
      setOperationId("");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível salvar os materiais."));
    }
  };

  const discardDraft = async () => {
    if (!draft) return;
    try {
      await discard.mutateAsync(draft.operationId);
      setDraft(null);
      setOperationId("");
      setFlashcards([]);
      setQuizQuestions([]);
      setDiscardOpen(false);
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível descartar este rascunho."));
    }
  };

  const invalid =
    flashcards.some(({ answer, question, selected }) =>
      selected ? !answer.trim() || !question.trim() : false,
    ) ||
    quizQuestions.some(({ options, prompt, selected }) =>
      selected
        ? !prompt.trim() ||
          options.some((option) => !option.trim()) ||
          hasDuplicateQuizOptionTexts(options)
        : false,
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0",
          draft ? "sm:max-w-5xl" : "sm:max-w-3xl",
        )}
      >
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>{draft ? "Revisar propostas" : "Gerar materiais com IA"}</DialogTitle>
          <DialogDescription>
            {draft
              ? "Edite e escolha o que realmente deve entrar na coleção."
              : "Escolha a fonte e a quantidade. A geração continua mesmo se você sair desta página."}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-5 lazuli-thin-scrollbar">
          {draft ? (
            <AiProposalReviewList
              flashcards={flashcards}
              onFlashcardChange={(id, change) =>
                setFlashcards((items) =>
                  items.map((item) => (item.id === id ? { ...item, ...change } : item)),
                )
              }
              onQuizChange={(id, change) =>
                setQuizQuestions((items) =>
                  items.map((item) => (item.id === id ? { ...item, ...change } : item)),
                )
              }
              onRemove={(id, kind) => {
                if (kind === "flashcard")
                  setFlashcards((items) => items.filter((item) => item.id !== id));
                else setQuizQuestions((items) => items.filter((item) => item.id !== id));
              }}
              quizQuestions={quizQuestions}
            />
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
            <div className="grid min-h-72 place-items-center text-center">
              <div>
                <CircleNotchIcon className="mx-auto mb-3 size-7 animate-spin text-primary" />
                <p className="font-medium">Gerando propostas…</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Você pode fechar esta janela e voltar depois.
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto grid max-w-2xl gap-5">
              <div className="grid gap-2">
                <Label>Projeto</Label>
                <Select value={projectId} onValueChange={changeProject}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.data?.items.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Documento</Label>
                <Select disabled={!projectId} value={documentId} onValueChange={setDocumentId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um documento" />
                  </SelectTrigger>
                  <SelectContent>
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
                  <Label>Seção</Label>
                  {sections.length ? (
                    <>
                      <Select value={sectionId} onValueChange={setSectionId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione uma seção" />
                        </SelectTrigger>
                        <SelectContent>
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
                      Este documento é grande demais e não possui seções reconhecidas. Divida-o com
                      títulos antes de gerar materiais.
                    </p>
                  )}
                </div>
              )}
              <div className="grid gap-2">
                <Label>Quantidade</Label>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 3, 5, 8, AI_COLLECTION_MAX_ITEMS].map((value) => (
                    <Button
                      key={value}
                      onClick={() => setQuantity(value)}
                      size="sm"
                      type="button"
                      variant={quantity === value ? "default" : "outline"}
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="collection-ai-guidance">Orientação (opcional)</Label>
                <Textarea
                  id="collection-ai-guidance"
                  maxLength={500}
                  onChange={(event) => setGuidance(event.target.value)}
                  placeholder="Ex.: priorize conceitos centrais e varie o nível das perguntas."
                  rows={3}
                  value={guidance}
                />
              </div>
              <div className="flex items-center gap-3 rounded-[var(--radius)] bg-muted/35 px-4 py-3 text-sm">
                <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
                  <CoinsIcon className="size-5" weight="duotone" />
                </span>
                <span>Custo: {cost} créditos</span>
                <span className="ml-auto text-muted-foreground">
                  Saldo: {balance.data?.available ?? "…"}
                </span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="m-0 rounded-none border-t px-6 py-4">
          {draft && (
            <Button onClick={() => setDiscardOpen(true)} variant="ghost">
              Descartar rascunho
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
              Salvar {selectedCount} {selectedCount === 1 ? "material" : "materiais"}
            </Button>
          ) : queryError ? (
            <Button onClick={() => setOperationId("")} variant="outline">
              Tentar novamente
            </Button>
          ) : (
            !busy && (
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
            )
          )}
        </DialogFooter>
      </DialogContent>
      <ConfirmationDialog
        actionLabel="Descartar"
        description="As propostas serão removidas. Os créditos já consumidos pela geração não serão devolvidos."
        destructive
        disabled={discard.isPending}
        onConfirm={discardDraft}
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
  disabled = false,
  iconOnly = false,
  kind,
}: {
  className?: string;
  collectionId: string;
  disabled?: boolean;
  iconOnly?: boolean;
  kind: AiMaterialKind;
}) => {
  const [open, setOpen] = useState(false);
  const latest = useLatestAiCollectionGeneration(collectionId, !disabled);
  const busy = latest.data?.status === "queued" || latest.data?.status === "processing";
  const ready = latest.data?.status === "completed";
  const material = kind === "flashcard" ? "flashcards" : "questões";
  const label = busy ? "Gerando…" : ready ? "Revisar geração" : "Gerar com IA";
  const trigger = (
    <Button
      aria-label={ready ? `Revisar ${material} gerados por IA` : `Gerar ${material} com IA`}
      className={className}
      disabled={disabled}
      onClick={() => setOpen(true)}
      size={iconOnly ? "icon" : "sm"}
      variant="outline"
    >
      {busy ? <CircleNotchIcon className="animate-spin" /> : <MagicWandIcon />}
      {!iconOnly && <span>{label}</span>}
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
        kind={kind}
        onOpenChange={setOpen}
        open={open}
      />
    </>
  );
};
