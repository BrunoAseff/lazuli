import { Spinner } from "@/components/ui/spinner.tsx";
import {
  AI_CREDITS_PER_ITEM,
  AI_SELECTION_MAX_ITEMS,
  type AiMaterialKind,
  type AiSelectionDraft,
  type DocumentBlock,
} from "@lazuli/shared";
import { ArrowClockwiseIcon, Trash2Icon } from "@/components/icons.tsx";
import { AiCreditCost } from "./ai-credit-cost.tsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import { ConfirmationDialog } from "@/components/confirmation-dialog.tsx";
import { NewTabIndicator } from "@/components/new-tab-indicator.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { CreationWorkspace } from "./creation-workspace.tsx";
import { SourceReading } from "@/features/references/components/source-reading.tsx";
import { ViewSelector } from "@/components/view-selector.tsx";
import { PlusIcon } from "@/components/icons.tsx";
import { PrepareSource } from "./prepare-source.tsx";
import { StudyCollectionDestination } from "@/components/study-collection-destination.tsx";
import { QuantitySelector } from "@/components/quantity-selector.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { CreditUpgradeGuard } from "@/features/billing/components/credit-upgrade-guard.tsx";
import { hasDuplicateQuizOptionTexts } from "@/features/quizzes/components/quiz-alternatives-field.tsx";
import type { AiEditableQuizProposal } from "./ai-quiz-proposal-editor.tsx";
import { AiProposalReviewList } from "./ai-proposal-review-list.tsx";
import { studyItemAgreement, studyItemCount } from "@/lib/text.ts";
import { getApiErrorMessage } from "@/lib/api-client.ts";
import { cn } from "@/lib/utils.ts";
import { AssetImage } from "@/components/asset-image.tsx";
import {
  clearAiReviewSession,
  readAiReviewSession,
  writeAiReviewSession,
} from "../ai-review-session.ts";
import type { AiSelectionAction } from "../ai-selection-types.ts";
import {
  useAiCreditBalance,
  useAiGeneration,
  useApproveAiGeneration,
  useCreateAiSelectionGeneration,
} from "../api/ai-queries.ts";

type EditableFlashcard = AiSelectionDraft["flashcards"][number] & { selected: boolean };
type EditableQuiz = AiSelectionDraft["quizQuestions"][number] &
  AiEditableQuizProposal & { selected: boolean };
const textContent = (text: string): DocumentBlock[] => [
  {
    id: crypto.randomUUID(),
    type: "paragraph",
    content: [{ type: "text", text: text.trim(), styles: {} }],
  },
];

const generationMessages = {
  AI_INPUT_TOO_LARGE:
    "Este documento é grande demais para uma única geração. Selecione um trecho menor.",
  AI_INSUFFICIENT_CREDITS: "Você não possui créditos suficientes para esta geração.",
  AI_RATE_LIMITED: "Muitas gerações foram solicitadas. Aguarde um pouco e tente novamente.",
  AI_REGENERATION_LIMIT: "O limite de três novas tentativas foi atingido.",
} as const;

const SelectionInlineContent = ({ content }: { content: DocumentBlock["content"] }) => {
  if (!Array.isArray(content)) return null;
  return content.map((item, itemIndex) => {
    const texts = item.type === "text" ? [item] : item.content;
    const rendered = texts.map((text, textIndex) => (
      <span
        className={cn(
          text.styles.bold && "font-semibold",
          text.styles.italic && "italic",
          text.styles.underline && "underline",
          text.styles.strike && "line-through",
        )}
        key={`${itemIndex}:${textIndex}`}
        style={{
          backgroundColor:
            typeof text.styles.backgroundColor === "string"
              ? text.styles.backgroundColor
              : undefined,
          color: typeof text.styles.textColor === "string" ? text.styles.textColor : undefined,
        }}
      >
        {text.text}
      </span>
    ));
    return item.type === "link" ? (
      <a
        className="text-primary underline underline-offset-2"
        href={item.href}
        key={itemIndex}
        rel="noreferrer"
        target="_blank"
      >
        {rendered}
        <NewTabIndicator />
      </a>
    ) : (
      rendered
    );
  });
};

const SelectionSourceBlocks = ({ blocks }: { blocks: DocumentBlock[] }) => (
  <div className="space-y-4">
    {blocks.map((block) => (
      <div key={block.id}>
        {block.content && !Array.isArray(block.content) ? (
          <div className="overflow-x-auto lazuli-thin-scrollbar">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {block.content.rows.map((row, index) => (
                  <tr key={index}>
                    {row.cells.map((cell, cellIndex) => (
                      <td key={cellIndex} className="border border-border/50 px-2.5 py-2 align-top">
                        <SelectionInlineContent
                          content={Array.isArray(cell) ? cell : cell.content}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p
            className={cn(
              block.type === "heading" && "font-sans text-base font-semibold",
              block.type === "quote" && "border-l-2 border-primary/30 pl-3",
            )}
          >
            {block.type === "bulletListItem" && "• "}
            <SelectionInlineContent content={block.content} />
          </p>
        )}
        {block.children?.length ? (
          <div className="mt-3 pl-4">
            <SelectionSourceBlocks blocks={block.children} />
          </div>
        ) : null}
      </div>
    ))}
  </div>
);

export const AiSelectionGenerationDialog = ({
  action,
  documentId,
  documentRevision,
  documentTitle = "",
  getDocumentContent,
  open,
  onApproved,
  onCancel,
  onMinimize,
}: {
  action: AiSelectionAction | null;
  documentId: string;
  documentRevision: number;
  /** Names the source when it is the whole document, whose text opens only on request. */
  documentTitle?: string;
  getDocumentContent: () => DocumentBlock[];
  open: boolean;
  onApproved: (revision: number) => Promise<void> | void;
  onCancel: () => void;
  onMinimize: () => void;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [kind, setKind] = useState<AiMaterialKind>("flashcard");
  const [collectionId, setCollectionId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [guidance, setGuidance] = useState("");
  const [operationId, setOperationId] = useState("");
  const [draft, setDraft] = useState<AiSelectionDraft | null>(null);
  const [flashcards, setFlashcards] = useState<EditableFlashcard[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<EditableQuiz[]>([]);
  const [regenerationConfirmationOpen, setRegenerationConfirmationOpen] = useState(false);
  const [showDocumentText, setShowDocumentText] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const balance = useAiCreditBalance();
  const createGeneration = useCreateAiSelectionGeneration();
  const generation = useAiGeneration(operationId);
  const approve = useApproveAiGeneration(operationId);
  const appliedOperationId = useRef("");
  const restoringReview = useRef(false);
  const dialogContent = useRef<HTMLDivElement>(null);
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
    if (!action) {
      setOperationId("");
      setDraft(null);
      setFlashcards([]);
      setQuizQuestions([]);
      setGuidance("");
      setQuantity(1);
      setRegenerationConfirmationOpen(false);
      appliedOperationId.current = "";
    }
  }, [action]);

  useEffect(() => {
    const result = generation.data;
    if (result?.status !== "completed") return;
    if (appliedOperationId.current === result.draft.operationId) return;
    appliedOperationId.current = result.draft.operationId;
    setDraft(result.draft);
    const saved = readAiReviewSession(result.draft.operationId);
    setFlashcards(
      saved?.flashcards ?? result.draft.flashcards.map((item) => ({ ...item, selected: true })),
    );
    setQuizQuestions(
      saved?.quizQuestions ??
        result.draft.quizQuestions.map((item) => ({ ...item, selected: true })),
    );
  }, [generation.data]);

  useEffect(() => {
    if (!open || !draft) return;
    const saved = readAiReviewSession(draft.operationId);
    if (!saved) return;
    restoringReview.current = true;
    setFlashcards(saved.flashcards);
    setQuizQuestions(saved.quizQuestions);
  }, [draft, open]);

  useEffect(() => {
    if (!draft || !draft.projectId) return;
    if (restoringReview.current) {
      restoringReview.current = false;
      return;
    }
    persistReview();
  }, [draft, flashcards, quizQuestions]);

  const selectedCount = useMemo(
    () =>
      (draft?.kind === "flashcard" ? flashcards : quizQuestions).filter(({ selected }) => selected)
        .length,
    [draft?.kind, flashcards, quizQuestions],
  );
  const selectedQuizHasDuplicateOptions = quizQuestions.some(
    ({ options, selected }) => selected && hasDuplicateQuizOptionTexts(options),
  );
  const selectedQuizMissingCorrectOption = quizQuestions.some(
    ({ correctOptionIndex, selected }) => selected && correctOptionIndex < 0,
  );

  const clearGenerationUrl = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("aiGeneration");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${params.size ? `?${params}` : ""}`,
    );
  };

  const requestGeneration = async (regenerateOperationId?: string) => {
    if (!action || !collectionId) return;
    try {
      const commonInput = {
        idempotencyKey: crypto.randomUUID(),
        documentId,
        expectedRevision: documentRevision,
        kind,
        collectionId,
        quantity,
        guidance,
        regenerateOperationId,
      };
      const result = await createGeneration.mutateAsync(
        action.sourceScope === "selection"
          ? {
              ...commonInput,
              anchorId: action.anchorId!,
              selectedPreview: action.selectedPreview ?? action.selectedText,
              selectedText: action.selectedText,
              sourceScope: "selection",
              sourceBlockIds: action.sourceBlockIds,
            }
          : action.sourceScope === "image"
            ? {
                ...commonInput,
                anchorId: action.anchorId!,
                selectedText: "" as const,
                sourceScope: "image" as const,
                sourceBlockIds: action.sourceBlockIds as [string],
              }
            : {
                ...commonInput,
                anchorId: null,
                selectedText: "",
                sourceScope: "document",
                sourceBlockIds: [],
              },
      );
      const nextOperationId =
        result.status === "completed" ? result.draft.operationId : result.operationId;
      setOperationId(nextOperationId);
      const params = new URLSearchParams(window.location.search);
      params.set("aiGeneration", nextOperationId);
      window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
      if (result.status === "completed") {
        setDraft(result.draft);
        setFlashcards(result.draft.flashcards.map((item) => ({ ...item, selected: true })));
        setQuizQuestions(result.draft.quizQuestions.map((item) => ({ ...item, selected: true })));
      }
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Não foi possível gerar os materiais.", generationMessages),
      );
    }
  };

  const save = async () => {
    if (!draft || selectedCount === 0) return;
    try {
      const result = await approve.mutateAsync({
        expectedRevision: documentRevision,
        anchoredContent: getDocumentContent(),
        flashcards:
          draft.kind === "flashcard"
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
          draft.kind === "quizQuestion"
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
      clearGenerationUrl();
      clearAiReviewSession(draft.operationId);
      const collectionPath =
        draft.kind === "flashcard"
          ? `/flashcards/${draft.collectionId}`
          : `/quizzes/${draft.collectionId}`;
      const destination =
        result.createdIds.length === 1
          ? `${collectionPath}?${draft.kind === "flashcard" ? "card" : "question"}=${result.createdIds[0]}`
          : collectionPath;
      toast.success(
        `${studyItemCount(draft.kind, result.createdIds.length)} ${studyItemAgreement(draft.kind, result.createdIds.length, "criad")} e ${studyItemAgreement(draft.kind, result.createdIds.length, "conectad")} à fonte.`,
        {
          action: {
            label:
              result.createdIds.length === 1
                ? draft.kind === "flashcard"
                  ? "Ver flashcard"
                  : "Ver questão"
                : "Ver coleção",
            onClick: () => void navigate(destination),
          },
        },
      );
      await onApproved(result.revision);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Não foi possível salvar os materiais.", generationMessages),
      );
    }
  };

  const close = () => {
    if (createGeneration.isPending || approve.isPending) return;
    setShowDocumentText(false);
    setGuidanceOpen(false);
    if (draft && flashcards.length + quizQuestions.length > 0) onMinimize();
    else onCancel();
  };
  const selectedSourcePreview = action?.selectedPreview || action?.selectedText || "";
  const selectedImage = useMemo(() => {
    if (action?.sourceScope !== "image" || !open) return null;
    const id = action.sourceBlockIds?.[0];
    const pending = [...getDocumentContent()];
    while (pending.length) {
      const block = pending.shift()!;
      if (block.id === id && block.type === "image") {
        const props = (block.props ?? {}) as { url?: string; name?: string; caption?: string };
        return props.url
          ? { url: props.url, name: props.name ?? "", caption: props.caption ?? "" }
          : null;
      }
      if (block.children) pending.push(...block.children);
    }
    return null;
  }, [action, getDocumentContent, open]);

  // What the material is made from, as text: the selected parts, the whole document or the
  // plain selection. An image is shown as itself.
  const sourceText = action?.selectedPreviewParts?.length ? (
    <div className="space-y-2 whitespace-normal">
      {action.selectedPreviewParts.map((part, index) =>
        part.kind === "table" ? (
          <div className="overflow-x-auto lazuli-thin-scrollbar" key={index}>
            <table className="w-full border-collapse text-sm">
              <tbody>
                {part.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td className="border border-border px-2.5 py-1.5 align-top" key={cellIndex}>
                        <SelectionInlineContent content={cell.content} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p
            className={cn(
              "whitespace-pre-wrap",
              part.blockType === "heading" && "font-semibold text-foreground",
              part.blockType === "quote" && "border-l-2 border-border pl-3 italic",
            )}
            key={index}
          >
            {part.text.startsWith("• ") && "• "}
            {part.text.startsWith("☐ ") && "☐ "}
            {/^\d+\. /.exec(part.text)?.[0]}
            {part.text.startsWith("> ") && "> "}
            <SelectionInlineContent content={part.content} />
          </p>
        ),
      )}
    </div>
  ) : action?.sourceScope === "document" ? (
    <SelectionSourceBlocks blocks={getDocumentContent()} />
  ) : (
    selectedSourcePreview
  );
  const sourceImage =
    action?.sourceScope === "image" && selectedImage ? (
      <figure className="grid gap-2">
        <AssetImage
          alt={selectedImage.name || "Imagem selecionada do documento"}
          className="max-h-[22rem] w-auto object-contain"
          url={selectedImage.url}
        />
        {selectedImage.caption && (
          <figcaption className="font-sans text-xs text-muted-foreground">
            {selectedImage.caption}
          </figcaption>
        )}
      </figure>
    ) : null;
  // While reviewing, the source sits beside the proposals so their links can open passages in it.
  const sourceSection = (
    <section>
      <p data-source-label>
        {action?.sourceScope === "document"
          ? "Documento inteiro"
          : action?.sourceScope === "image"
            ? "Imagem selecionada"
            : "Trecho selecionado"}
      </p>
      {sourceImage ?? (
        <SourceReading key={action?.anchorId ?? documentId} text={selectedSourcePreview}>
          {sourceText}
        </SourceReading>
      )}
    </section>
  );

  return (
    <>
      <Dialog open={open && Boolean(action)} onOpenChange={(nextOpen) => !nextOpen && close()}>
        <DialogContent
          ref={dialogContent}
          onOpenAutoFocus={(event) => {
            const choice = dialogContent.current?.querySelector<HTMLButtonElement>(
              '[data-kind-choice] [aria-pressed="true"]',
            );
            if (choice) {
              event.preventDefault();
              choice.focus();
            }
          }}
          className={cn(
            "max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0",
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
                : "Você revisa as propostas antes de salvar."}
            </DialogDescription>
          </DialogHeader>

          <div
            className={cn(
              "relative min-h-0 overflow-y-auto lazuli-thin-scrollbar",
              draft ? "px-6 py-7 sm:px-8 md:overflow-hidden" : "px-6 pt-5 pb-6",
            )}
          >
            {draft ? (
              <CreationWorkspace reviewing source={sourceSection}>
                <div className="grid gap-6">
                  {/* The count and what will be saved are in the list beside; here only the one
                      choice left: try again, which costs nothing (three attempts are included). */}
                  <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                    <p className="text-xs text-muted-foreground">
                      {draft.regenerationCount >= 3
                        ? "Novas tentativas esgotadas"
                        : `Sem custo · ${3 - draft.regenerationCount} de 3 tentativas`}
                    </p>
                    <Button
                      disabled={createGeneration.isPending || draft.regenerationCount >= 3}
                      onClick={() => setRegenerationConfirmationOpen(true)}
                      size="sm"
                      variant="outline"
                    >
                      <ArrowClockwiseIcon /> Gerar novamente
                    </Button>
                  </div>

                  <AiProposalReviewList
                    flashcards={flashcards}
                    onFlashcardChange={(id, change) =>
                      setFlashcards((current) =>
                        current.map((item) => (item.id === id ? { ...item, ...change } : item)),
                      )
                    }
                    onNavigateReference={() => {
                      persistReview();
                      onMinimize();
                    }}
                    onQuizChange={(id, change) =>
                      setQuizQuestions((current) =>
                        current.map((item) => (item.id === id ? { ...item, ...change } : item)),
                      )
                    }
                    onRemove={(id, kind) => {
                      const remainingCount = flashcards.length + quizQuestions.length - 1;
                      if (kind === "flashcard")
                        setFlashcards((current) => current.filter((item) => item.id !== id));
                      else setQuizQuestions((current) => current.filter((item) => item.id !== id));
                      if (remainingCount === 0) {
                        clearAiReviewSession(draft.operationId);
                        clearGenerationUrl();
                        setDraft(null);
                        onCancel();
                      }
                    }}
                    operationId={draft.operationId}
                    quizQuestions={quizQuestions}
                    returnTo={`${location.pathname}${location.search}`}
                    source={{
                      documentId: draft.documentId,
                      documentTitle: draft.documentTitle,
                      projectId: draft.projectId ?? "",
                      projectTitle: draft.projectTitle,
                    }}
                  />
                </div>
              </CreationWorkspace>
            ) : (
              <div className="grid gap-5">
                <PrepareSource
                  documentTitle={documentTitle}
                  expanded={showDocumentText}
                  onToggle={() => setShowDocumentText(!showDocumentText)}
                  scope={action?.sourceScope ?? "selection"}
                >
                  {sourceImage ?? sourceText}
                </PrepareSource>
                <div className="grid gap-5">
                  <div className="grid gap-2" data-kind-choice>
                    <Label>O que criar?</Label>
                    <ViewSelector
                      fullWidth
                      label="O que criar"
                      onChange={(next) => {
                        setKind(next as AiMaterialKind);
                        setCollectionId("");
                      }}
                      options={[
                        { value: "flashcard", label: "Flashcards" },
                        { value: "quizQuestion", label: "Questões" },
                      ]}
                      value={kind}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>{kind === "flashcard" ? "Quantos?" : "Quantas?"}</Label>
                    <QuantitySelector
                      label="Quantidade de propostas"
                      value={quantity}
                      options={Array.from(
                        { length: AI_SELECTION_MAX_ITEMS },
                        (_, index) => index + 1,
                      )}
                      onChange={setQuantity}
                    />
                  </div>

                  <StudyCollectionDestination
                    key={kind}
                    kind={kind}
                    autoSelect
                    label="Salvar em"
                    value={collectionId}
                    onChange={setCollectionId}
                  />

                  {/* Optional guidance stays out of the way until wanted. */}
                  {guidanceOpen || guidance ? (
                    <div className="grid gap-2">
                      <Label htmlFor="ai-guidance">
                        Orientação para a IA{" "}
                        <span className="font-normal text-muted-foreground">Opcional</span>
                      </Label>
                      <Textarea
                        autoFocus={guidanceOpen && !guidance}
                        id="ai-guidance"
                        maxLength={500}
                        onChange={(event) => setGuidance(event.target.value)}
                        placeholder="Ex.: priorize conceitos e evite perguntas sobre datas."
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
            {(createGeneration.isPending || generation.data?.status === "running") && (
              <div className="absolute inset-0 grid place-items-center bg-background/80 backdrop-blur-sm">
                <div className="text-center">
                  <Spinner
                    aria-hidden="true"
                    role="presentation"
                    className="mx-auto mb-3 size-7 text-muted-foreground"
                  />
                  <p className="font-medium">Criando propostas…</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Você pode fechar e continuar depois.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 flex-col rounded-none border-t px-6 py-4 sm:items-center">
            {!draft && (
              <div className="w-full sm:mr-auto sm:w-auto">
                <AiCreditCost cost={cost} available={balance.data?.available} />
              </div>
            )}
            {draft && (
              <Button
                className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
                disabled={approve.isPending}
                onClick={() => setDiscardOpen(true)}
                type="button"
                variant="ghost"
              >
                <Trash2Icon /> Descartar propostas
              </Button>
            )}
            <Button
              className="w-full min-w-0 shrink sm:w-auto"
              disabled={createGeneration.isPending || approve.isPending}
              onClick={close}
              type="button"
              variant="outline"
            >
              {draft ? "Fechar" : "Cancelar"}
            </Button>
            {draft ? (
              <Button
                pending={approve.isPending}
                className="w-full min-w-0 shrink sm:w-auto"
                disabled={
                  approve.isPending ||
                  selectedCount === 0 ||
                  flashcards.some(({ answer, question, selected }) =>
                    selected ? !answer.trim() || !question.trim() : false,
                  ) ||
                  quizQuestions.some(({ options, prompt, selected }) =>
                    selected ? !prompt.trim() || options.some((option) => !option.trim()) : false,
                  ) ||
                  selectedQuizHasDuplicateOptions ||
                  selectedQuizMissingCorrectOption
                }
                onClick={() => void save()}
              >
                Salvar {studyItemCount(draft.kind, selectedCount)}
              </Button>
            ) : (
              <CreditUpgradeGuard available={balance.data?.available} cost={cost}>
                <Button
                  className="w-full min-w-0 shrink sm:w-auto"
                  disabled={
                    !collectionId || balance.data === undefined || balance.data.available < cost
                  }
                  onClick={() => void requestGeneration()}
                  pending={createGeneration.isPending}
                  pendingLabel="Iniciando"
                >
                  Gerar propostas
                </Button>
              </CreditUpgradeGuard>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        actionLabel="Descartar"
        description="As propostas serão removidas. Os créditos já consumidos pela geração não serão devolvidos."
        destructive
        onConfirm={() => {
          if (!draft) return;
          clearAiReviewSession(draft.operationId);
          clearGenerationUrl();
          setDraft(null);
          setDiscardOpen(false);
          onCancel();
        }}
        onOpenChange={setDiscardOpen}
        open={discardOpen}
        title="Descartar todas as propostas?"
      />
      <ConfirmationDialog
        actionLabel="Gerar novamente"
        description="As propostas atuais serão substituídas. Esta tentativa está incluída e não consumirá novos créditos."
        onConfirm={async () => {
          setRegenerationConfirmationOpen(false);
          if (draft) await requestGeneration(draft.operationId);
        }}
        onOpenChange={setRegenerationConfirmationOpen}
        open={regenerationConfirmationOpen}
        title="Substituir as propostas atuais?"
      />
    </>
  );
};
