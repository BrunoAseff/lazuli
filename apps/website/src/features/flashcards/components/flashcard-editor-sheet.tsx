import { useCreateBlockNote } from "@blocknote/react";
import { flashcardContentSchema, type FlashcardDetail } from "@lazuli/shared";
import { MagicWandIcon } from "@/components/icons.tsx";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  DiscardStudyItemChangesDialog,
  StudyItemActionsPanel,
  StudyItemDetails,
  StudyRefineAction,
  StudyDetailsButton,
} from "@/components/study-item-editor-controls.tsx";
import { Button } from "@/components/ui/button.tsx";
import { FlashcardMemoryStatus } from "./flashcard-items.tsx";
import { StudyCollectionDestination } from "@/components/study-collection-destination.tsx";
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { releaseResolvedAssetUrls, resolveAssetUrl } from "@/features/assets/asset-api.ts";
import { cleanupAssets, collectAssetUrls } from "@/features/assets/rich-content-assets.ts";
import { lazuliBlockNoteDictionary } from "@/features/documents/editor/blocknote-dictionary.ts";
import {
  documentSchema,
  type LazuliDocumentBlock,
} from "@/features/documents/editor/document-schema.tsx";
import { RichContentField } from "@/components/rich-content-field.tsx";
import { ReferenceManager } from "@/features/references/components/reference-manager.tsx";
import { ReferenceSourcePreview } from "@/features/references/components/reference-source-preview.tsx";
import { CreationWorkspace } from "@/features/ai/components/creation-workspace.tsx";
import { AiMaterialImprovementDialog } from "@/features/ai/components/ai-material-improvement-dialog.tsx";
import type { StudyItemAction } from "@/lib/study-actions.ts";
import type { StudyEditorPresentation } from "@/lib/study-editor.ts";
import { uploadFlashcardImage } from "../api/flashcard-api.ts";
import { useCreateFlashcard, useUpdateFlashcard } from "../api/flashcard-queries.ts";
import { getFlashcardCollectionErrorMessage } from "../flashcard-messages.ts";
import { SelectionPreview } from "@/features/ai/components/selection-preview.tsx";
import type { AiSelectionPreviewPart } from "@/features/ai/ai-selection-types.ts";

type FlashcardEditorProps = {
  card?: FlashcardDetail;
  collectionId?: string;
  initialAnswer?: FlashcardDetail["answer"] | LazuliDocumentBlock;
  initialQuestion?: FlashcardDetail["question"] | LazuliDocumentBlock;
  onCreated?: (cardId: string) => void | boolean | Promise<void | boolean>;
  onAction?: (action: StudyItemAction) => void;
  onOpenChange: (open: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: (cardId: string, collectionId: string) => void;
  open: boolean;
  presentation: StudyEditorPresentation;
  readOnly?: boolean;
  sourcePreview?: string;
  /** The selection block by block; without it the plain text is shown. */
  sourcePreviewParts?: AiSelectionPreviewPart[];
};

const FlashcardEditor = ({
  card,
  collectionId,
  initialAnswer,
  initialQuestion,
  onCreated,
  onAction,
  onOpenChange,
  onDirtyChange,
  onSaved,
  open,
  presentation,
  readOnly = false,
  sourcePreview,
  sourcePreviewParts,
}: FlashcardEditorProps) => {
  const [targetCollectionId, setTargetCollectionId] = useState(
    card?.collectionId ?? collectionId ?? "",
  );
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [improvementOpen, setImprovementOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ answer?: string; question?: string }>({});
  const createdUrls = useRef(new Set<string>());
  const committed = useRef(false);
  const create = useCreateFlashcard(targetCollectionId);
  const update = useUpdateFlashcard(collectionId ?? targetCollectionId, card?.id ?? "");
  const initialQuestionKey = JSON.stringify(initialQuestion ?? null);
  const initialAnswerKey = JSON.stringify(initialAnswer ?? null);
  const question = useCreateBlockNote(
    {
      schema: documentSchema,
      initialContent:
        (card?.question as LazuliDocumentBlock | undefined) ??
        (initialQuestion as LazuliDocumentBlock | undefined),
      dictionary: lazuliBlockNoteDictionary,
      uploadFile: async (file) => {
        const uploaded = await uploadFlashcardImage(file);
        createdUrls.current.add(uploaded.url);
        return uploaded.url;
      },
      resolveFileUrl: resolveAssetUrl,
    },
    [card?.id, initialQuestionKey],
  );
  const answer = useCreateBlockNote(
    {
      schema: documentSchema,
      initialContent:
        (card?.answer as LazuliDocumentBlock | undefined) ??
        (initialAnswer as LazuliDocumentBlock | undefined),
      dictionary: lazuliBlockNoteDictionary,
      uploadFile: async (file) => {
        const uploaded = await uploadFlashcardImage(file);
        createdUrls.current.add(uploaded.url);
        return uploaded.url;
      },
      resolveFileUrl: resolveAssetUrl,
    },
    [card?.id, initialAnswerKey],
  );
  const [questionValid, setQuestionValid] = useState(Boolean(card || initialQuestion));
  const [answerValid, setAnswerValid] = useState(Boolean(card || initialAnswer));

  useEffect(() => {
    committed.current = false;
    return () => {
      releaseResolvedAssetUrls();
      if (!committed.current) void cleanupAssets([...createdUrls.current]);
    };
  }, []);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  // A new flashcard starts with the cursor in its question, once the dialog or panel has rendered.
  useEffect(() => {
    if (!open || card || readOnly) return;
    const timer = window.setTimeout(() => question.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [card, open, question, readOnly]);

  const isPending = create.isPending || update.isPending;
  const requestClose = () => {
    if (presentation === "panel") return;
    if (dirty) setDiscardOpen(true);
    else onOpenChange(false);
  };
  const save = async (createAnother = false) => {
    const parsedQuestion = flashcardContentSchema.safeParse(question.document);
    const parsedAnswer = flashcardContentSchema.safeParse(answer.document);
    if (!parsedQuestion.success || !parsedAnswer.success) {
      setFieldErrors({
        question: parsedQuestion.success ? undefined : parsedQuestion.error.issues[0]?.message,
        answer: parsedAnswer.success ? undefined : parsedAnswer.error.issues[0]?.message,
      });
      toast.error("Preencha a pergunta e a resposta antes de salvar.");
      return;
    }
    setFieldErrors({});
    const referencedUrls = new Set([
      ...collectAssetUrls(parsedQuestion.data as LazuliDocumentBlock),
      ...collectAssetUrls(parsedAnswer.data as LazuliDocumentBlock),
    ]);
    const unusedUploads = [...createdUrls.current].filter((url) => !referencedUrls.has(url));
    const failedCleanup = new Set(await cleanupAssets(unusedUploads));
    for (const url of unusedUploads) if (!failedCleanup.has(url)) createdUrls.current.delete(url);
    try {
      if (card) {
        const sameQuestion = JSON.stringify(parsedQuestion.data) === JSON.stringify(card.question);
        const sameAnswer = JSON.stringify(parsedAnswer.data) === JSON.stringify(card.answer);
        const sameCollection = targetCollectionId === card.collectionId;
        if (sameQuestion && sameAnswer && sameCollection) {
          committed.current = true;
          setDirty(false);
          onSaved?.(card.id, card.collectionId);
          if (presentation === "dialog") onOpenChange(false);
          return;
        }
        const saved = await update.mutateAsync({
          ...(!sameQuestion && { question: parsedQuestion.data }),
          ...(!sameAnswer && { answer: parsedAnswer.data }),
          ...(!sameCollection && { collectionId: targetCollectionId }),
        });
        onSaved?.(saved.id, saved.collectionId);
        toast.success("Flashcard atualizado.");
      } else {
        const cardId = crypto.randomUUID();
        await create.mutateAsync({
          id: cardId,
          question: parsedQuestion.data,
          answer: parsedAnswer.data,
        });
        onSaved?.(cardId, targetCollectionId);
        const followUpSucceeded = await onCreated?.(cardId);
        if (followUpSucceeded === false)
          toast.warning("Flashcard criado, mas a fonte não pôde ser conectada.");
        else if (!onCreated) toast.success("Flashcard criado.");
      }
      committed.current = true;
      createdUrls.current.clear();
      setDirty(false);
      if (createAnother && !card) {
        question.replaceBlocks(question.document, [{ type: "paragraph" }]);
        answer.replaceBlocks(answer.document, [{ type: "paragraph" }]);
        setQuestionValid(false);
        setAnswerValid(false);
        setFieldErrors({});
        committed.current = false;
        return;
      }
      if (presentation === "dialog") onOpenChange(false);
    } catch (error) {
      toast.error(
        getFlashcardCollectionErrorMessage(error, "Não foi possível salvar o flashcard."),
      );
    }
  };

  const changeQuestion = () => {
    const parsed = flashcardContentSchema.safeParse(question.document);
    setQuestionValid(parsed.success);
    setDirty(true);
    setFieldErrors((current) => ({
      ...current,
      question: parsed.success ? undefined : parsed.error.issues[0]?.message,
    }));
  };
  const changeAnswer = () => {
    const parsed = flashcardContentSchema.safeParse(answer.document);
    setAnswerValid(parsed.success);
    setDirty(true);
    setFieldErrors((current) => ({
      ...current,
      answer: parsed.success ? undefined : parsed.error.issues[0]?.message,
    }));
  };
  const collectionPicker = (
    <CollectionPicker
      // A new material starts in the first collection, like the AI dialogs; that default is not an edit.
      autoSelect={!card}
      disabled={readOnly}
      value={targetCollectionId}
      onChange={(value) => {
        if (targetCollectionId) setDirty(true);
        setTargetCollectionId(value);
      }}
    />
  );
  const fields = (
    <>
      {sourcePreview && presentation === "panel" && <ReferenceSourcePreview text={sourcePreview} />}
      <RichContentField
        appearance={presentation === "panel" ? "workbench" : "boxed"}
        editable={!readOnly}
        editor={question}
        error={fieldErrors.question}
        label="Pergunta"
        onChange={changeQuestion}
      />
      <RichContentField
        appearance={presentation === "panel" ? "workbench" : "boxed"}
        editable={!readOnly}
        editor={answer}
        error={fieldErrors.answer}
        label="Resposta"
        onChange={changeAnswer}
      />
    </>
  );
  const saveButton = (
    <Button
      pending={isPending}
      disabled={
        readOnly ||
        isPending ||
        Boolean(card && !dirty) ||
        !targetCollectionId ||
        !questionValid ||
        !answerValid
      }
      onClick={() => void save()}
    >
      Salvar
    </Button>
  );
  const improveButton = card && !readOnly && (
    <Button
      disabled={dirty || isPending}
      onClick={() => setImprovementOpen(true)}
      variant="outline"
    >
      <MagicWandIcon aria-hidden="true" /> Refinar com IA
    </Button>
  );
  const details = (
    <>
      {collectionPicker}
      {card && (
        <div className="mt-6">
          <ReferenceManager
            disabled={dirty || readOnly}
            returnTo={`/flashcards/${card.collectionId}?card=${card.id}`}
            target={{ type: "flashcard", id: card.id }}
          />
        </div>
      )}
      {readOnly && <p className="mt-5 text-xs text-muted-foreground">Coleção arquivada.</p>}
      {card && onAction && (
        <StudyItemActionsPanel
          archived={Boolean(card.archivedAt)}
          canMove
          canDuplicate
          onAction={onAction}
        />
      )}
    </>
  );

  return (
    <>
      {presentation === "dialog" ? (
        <Dialog open={open} onOpenChange={(next) => !next && requestClose()}>
          <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-5xl">
            <DialogHeader className="px-6 py-5">
              <DialogTitle className="pr-8">
                {card ? "Editar flashcard" : "Novo flashcard"}
              </DialogTitle>
              <DialogDescription>
                Escreva uma pergunta clara e uma resposta objetiva.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 overflow-y-auto px-6 py-6 lazuli-thin-scrollbar">
              {/* With an excerpt, the left pane is the source alone and the collection joins the material;
                  without one, the left pane holds where the card goes. */}
              <CreationWorkspace
                sourceControls={!sourcePreview}
                composing
                sourceLabel={sourcePreview ? "Trecho de origem" : "Destino"}
                source={
                  sourcePreview ? (
                    sourcePreviewParts?.length ? (
                      <SelectionPreview parts={sourcePreviewParts} />
                    ) : (
                      <blockquote>{sourcePreview}</blockquote>
                    )
                  ) : (
                    <div className="font-sans text-sm">{collectionPicker}</div>
                  )
                }
              >
                {sourcePreview && <div className="font-sans text-sm">{collectionPicker}</div>}
                <div className="grid gap-6">{fields}</div>
                {card && (
                  <ReferenceManager
                    disabled={dirty}
                    returnTo={`/flashcards/${card.collectionId}?card=${card.id}`}
                    target={{ type: "flashcard", id: card.id }}
                  />
                )}
              </CreationWorkspace>
            </div>
            <DialogFooter className="mx-0 mb-0 px-6 py-4 sm:flex-row sm:justify-end">
              <DialogCancelButton disabled={isPending} onClick={requestClose}>
                Cancelar
              </DialogCancelButton>
              {!card && !onCreated && (
                <Button
                  disabled={isPending || !targetCollectionId || !questionValid || !answerValid}
                  onClick={() => void save(true)}
                  variant="outline"
                >
                  Salvar e criar outro
                </Button>
              )}
              {improveButton}
              {saveButton}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <div className="grid min-h-0 min-w-0 flex-1 bg-background @min-[960px]/study-workspace:grid-cols-[minmax(0,1fr)_16rem]">
          <section className="@container/editor m-2 flex min-h-0 min-w-0 flex-col overflow-y-auto rounded-xl bg-card px-5 py-4 ring-1 ring-border/45 lazuli-thin-scrollbar sm:px-6 lg:px-8">
            <header className="sticky top-0 z-10 mx-auto flex min-h-10 w-full max-w-3xl flex-wrap items-center justify-between gap-3 bg-card py-2">
              {card && <FlashcardMemoryStatus card={card} />}
              <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                <StudyDetailsButton onClick={() => setDetailsSheetOpen(true)} />
                {!readOnly && (
                  <>
                    {card && (
                      <StudyRefineAction
                        disabled={dirty || isPending}
                        onImprove={() => setImprovementOpen(true)}
                      />
                    )}
                    {saveButton}
                  </>
                )}
              </div>
            </header>
            <div className="mx-auto w-full max-w-3xl pt-[clamp(1.5rem,4vh,2.5rem)] pb-8">
              {sourcePreview && <ReferenceSourcePreview text={sourcePreview} />}
              <RichContentField
                appearance="workbench"
                editable={!readOnly}
                editor={question}
                error={fieldErrors.question}
                label="Pergunta"
                onChange={changeQuestion}
                workbenchRole="question"
              />
              <div className="my-7 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <span className="h-px bg-border/50" />
                <span className="text-xs text-muted-foreground">Resposta</span>
                <span className="h-px bg-border/50" />
              </div>
              <RichContentField
                appearance="workbench"
                editable={!readOnly}
                editor={answer}
                error={fieldErrors.answer}
                label=""
                onChange={changeAnswer}
                workbenchRole="answer"
              />
            </div>
          </section>
          <StudyItemDetails
            description="Coleção e fontes deste flashcard."
            onOpenChange={setDetailsSheetOpen}
            open={detailsSheetOpen}
          >
            {details}
          </StudyItemDetails>
        </div>
      )}
      <DiscardStudyItemChangesDialog
        description="O conteúdo ainda não foi salvo."
        onDiscard={() => onOpenChange(false)}
        onOpenChange={setDiscardOpen}
        open={discardOpen}
      />
      {card && (
        <AiMaterialImprovementDialog
          material={{ kind: "flashcard", value: card }}
          onApplied={(input) => {
            if (input.kind !== "flashcard") return;
            question.replaceBlocks(question.document, input.question as LazuliDocumentBlock);
            answer.replaceBlocks(answer.document, input.answer as LazuliDocumentBlock);
            setQuestionValid(true);
            setAnswerValid(true);
            setDirty(false);
          }}
          onOpenChange={setImprovementOpen}
          open={improvementOpen}
        />
      )}
    </>
  );
};

export const FlashcardEditorDialog = (props: Omit<FlashcardEditorProps, "presentation">) => (
  <FlashcardEditor {...props} presentation="dialog" />
);

export const FlashcardEditorPanel = (props: Omit<FlashcardEditorProps, "presentation">) => (
  <FlashcardEditor {...props} presentation="panel" />
);

export const CollectionPicker = ({
  disabled = false,
  autoSelect = false,
  value,
  onChange,
}: {
  autoSelect?: boolean;
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <StudyCollectionDestination
      autoSelect={autoSelect}
      kind="flashcard"
      disabled={disabled}
      onChange={onChange}
      value={value}
    />
  );
};
