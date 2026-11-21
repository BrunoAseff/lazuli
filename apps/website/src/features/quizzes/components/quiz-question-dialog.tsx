import { useCreateBlockNote } from "@blocknote/react";
import { quizQuestionContentSchema, type QuizQuestionDetail } from "@lazuli/shared";
import { MagicWandIcon } from "@/components/icons.tsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { StudyCollectionDestination } from "@/components/study-collection-destination.tsx";
import {
  DiscardStudyItemChangesDialog,
  StudyItemActionsPanel,
  StudyItemDetails,
  StudyRefineAction,
  StudyDetailsButton,
} from "@/components/study-item-editor-controls.tsx";
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { cleanupAssets, collectAssetUrls } from "@/features/assets/rich-content-assets.ts";
import { resolveAssetUrl, releaseResolvedAssetUrls } from "@/features/assets/asset-api.ts";
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
import { uploadQuizImage } from "../api/quiz-api.ts";
import { useCreateQuizQuestion, useUpdateQuizQuestion } from "../api/quiz-queries.ts";
import {
  QuizAlternativesField,
  quizOptionsAreValid,
  type QuizOptionDraft,
} from "./quiz-alternatives-field.tsx";
import { SelectionPreview } from "@/features/ai/components/selection-preview.tsx";
import type { AiSelectionPreviewPart } from "@/features/ai/ai-selection-types.ts";

const newOptions = (): QuizOptionDraft[] => [
  { id: crypto.randomUUID(), text: "", isCorrect: true },
  { id: crypto.randomUUID(), text: "", isCorrect: false },
];

type QuizQuestionEditorProps = {
  collectionId?: string;
  initialContent?: LazuliDocumentBlock | QuizQuestionDetail["content"];
  initialOptions?: QuizOptionDraft[];
  onAction?: (action: StudyItemAction) => void;
  onCreated?: (questionId: string) => void | boolean | Promise<void | boolean>;
  onDirtyChange?: (dirty: boolean) => void;
  onOpenChange: (open: boolean) => void;
  onSaved?: (questionId: string, collectionId: string) => void;
  open: boolean;
  presentation: StudyEditorPresentation;
  question?: QuizQuestionDetail;
  readOnly?: boolean;
  sourcePreview?: string;
  /** The selection block by block; without it the plain text is shown. */
  sourcePreviewParts?: AiSelectionPreviewPart[];
};

const QuizQuestionEditor = ({
  collectionId,
  initialContent,
  initialOptions,
  onAction,
  onCreated,
  onDirtyChange,
  onOpenChange,
  onSaved,
  open,
  presentation,
  question,
  readOnly = false,
  sourcePreview,
  sourcePreviewParts,
}: QuizQuestionEditorProps) => {
  const [targetCollectionId, setTargetCollectionId] = useState(
    question?.collectionId ?? collectionId ?? "",
  );
  const [options, setOptions] = useState<QuizOptionDraft[]>(
    question?.options.map(({ id, isCorrect, text }) => ({
      id,
      isCorrect,
      text,
    })) ??
      initialOptions ??
      newOptions(),
  );
  const [contentValid, setContentValid] = useState(Boolean(question || initialContent));
  const [touched, setTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [improvementOpen, setImprovementOpen] = useState(false);
  const createdUrls = useRef(new Set<string>());
  const committed = useRef(false);
  const create = useCreateQuizQuestion(targetCollectionId);
  const update = useUpdateQuizQuestion(collectionId ?? targetCollectionId, question?.id ?? "");
  const editor = useCreateBlockNote(
    {
      schema: documentSchema,
      initialContent:
        (question?.content as LazuliDocumentBlock | undefined) ??
        (initialContent as LazuliDocumentBlock | undefined),
      dictionary: lazuliBlockNoteDictionary,
      uploadFile: async (file) => {
        const uploaded = await uploadQuizImage(file);
        createdUrls.current.add(uploaded.url);
        return uploaded.url;
      },
      resolveFileUrl: resolveAssetUrl,
    },
    [JSON.stringify(initialContent ?? null), question?.id],
  );
  useEffect(
    () => () => {
      releaseResolvedAssetUrls();
      if (!committed.current) void cleanupAssets([...createdUrls.current]);
    },
    [],
  );
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  // A new question starts with the cursor in it, once the dialog or panel has rendered.
  useEffect(() => {
    if (!open || question || readOnly) return;
    const timer = window.setTimeout(() => editor.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [editor, open, question, readOnly]);
  const optionsValid = useMemo(() => quizOptionsAreValid(options), [options]);
  const requestClose = () => {
    if (presentation === "panel") return;
    if (dirty) setDiscardOpen(true);
    else onOpenChange(false);
  };
  const save = async (createAnother = false) => {
    const parsed = quizQuestionContentSchema.safeParse(editor.document);
    setTouched(true);
    if (!parsed.success || !optionsValid) return;
    const referenced = new Set(collectAssetUrls(parsed.data as LazuliDocumentBlock));
    await cleanupAssets([...createdUrls.current].filter((url) => !referenced.has(url)));
    try {
      const normalizedOptions = options.map(({ id, isCorrect, text }) => ({
        id,
        isCorrect,
        text: text.trim(),
      }));
      if (question) {
        const sameContent = JSON.stringify(parsed.data) === JSON.stringify(question.content);
        const sameOptions =
          JSON.stringify(normalizedOptions) ===
          JSON.stringify(
            question.options.map(({ id, isCorrect, text }) => ({
              id,
              isCorrect,
              text,
            })),
          );
        const sameCollection = targetCollectionId === question.collectionId;
        if (sameContent && sameOptions && sameCollection) {
          committed.current = true;
          setDirty(false);
          onSaved?.(question.id, question.collectionId);
          if (presentation === "dialog") onOpenChange(false);
          return;
        }
        const saved = await update.mutateAsync({
          ...(!sameContent && { content: parsed.data }),
          ...(!sameOptions && { options: normalizedOptions }),
          ...(!sameCollection && { collectionId: targetCollectionId }),
        });
        onSaved?.(saved.id, saved.collectionId);
      } else {
        const questionId = crypto.randomUUID();
        await create.mutateAsync({
          id: questionId,
          content: parsed.data,
          options: normalizedOptions,
        });
        onSaved?.(questionId, targetCollectionId);
        const followUpSucceeded = await onCreated?.(questionId);
        if (followUpSucceeded === false)
          toast.warning("Questão criada, mas a fonte não pôde ser conectada.");
      }
      committed.current = true;
      createdUrls.current.clear();
      if (question || !onCreated)
        toast.success(question ? "Questão atualizada." : "Questão criada.");
      setDirty(false);
      if (createAnother && !question) {
        editor.replaceBlocks(editor.document, [{ type: "paragraph" }]);
        setOptions(newOptions());
        setContentValid(false);
        setTouched(false);
        committed.current = false;
        return;
      }
      if (presentation === "dialog") onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar a questão.");
    }
  };
  const isPending = create.isPending || update.isPending;
  const collectionPicker = (
    <QuizCollectionPicker
      // A new material starts in the first collection, like the AI dialogs; that default is not an edit.
      autoSelect={!question}
      disabled={readOnly}
      value={targetCollectionId}
      onChange={(value) => {
        if (targetCollectionId) setDirty(true);
        setTargetCollectionId(value);
      }}
    />
  );
  const alternatives = (
    <QuizAlternativesField
      onChange={(next) => {
        setDirty(true);
        setOptions(next);
      }}
      options={options}
      readOnly={readOnly}
      touched={touched}
    />
  );
  const fields = (
    <>
      {sourcePreview && presentation === "panel" && <ReferenceSourcePreview text={sourcePreview} />}
      <RichContentField
        appearance={presentation === "panel" ? "workbench" : "boxed"}
        editable={!readOnly}
        editor={editor}
        error={touched && !contentValid ? "Informe uma pergunta." : undefined}
        label="Pergunta"
        onChange={() => {
          setContentValid(quizQuestionContentSchema.safeParse(editor.document).success);
          setDirty(true);
        }}
        workbenchRole="question"
      />
      {alternatives}
    </>
  );
  const saveButton = (
    <Button
      pending={isPending}
      disabled={
        readOnly ||
        isPending ||
        Boolean(question && !dirty) ||
        !targetCollectionId ||
        !contentValid ||
        !optionsValid
      }
      onClick={() => void save()}
    >
      Salvar
    </Button>
  );
  const improveButton = question && !readOnly && (
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
      {question && (
        <div className="mt-6">
          <ReferenceManager
            disabled={dirty || readOnly}
            returnTo={`/quizzes/${question.collectionId}?question=${question.id}`}
            target={{ type: "quizQuestion", id: question.id }}
          />
        </div>
      )}
      {readOnly && <p className="mt-5 text-xs text-muted-foreground">Questão arquivada.</p>}
      {question && onAction && (
        <StudyItemActionsPanel
          archived={Boolean(question.archivedAt)}
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
                {question ? "Editar questão" : "Nova questão"}
              </DialogTitle>
              <DialogDescription>
                Crie a pergunta e marque uma única resposta correta.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 overflow-y-auto px-6 py-6 lazuli-thin-scrollbar">
              {/* With an excerpt, the left pane is the source alone and the collection joins the material;
                  without one, the left pane holds where the question goes. */}
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
                {question && (
                  <ReferenceManager
                    disabled={dirty}
                    returnTo={`/quizzes/${question.collectionId}?question=${question.id}`}
                    target={{ type: "quizQuestion", id: question.id }}
                  />
                )}
              </CreationWorkspace>
            </div>
            <DialogFooter className="mx-0 mb-0 px-6 py-4">
              <DialogCancelButton disabled={isPending} onClick={requestClose}>
                Cancelar
              </DialogCancelButton>
              {!question && !onCreated && (
                <Button
                  disabled={isPending || !targetCollectionId || !contentValid || !optionsValid}
                  onClick={() => void save(true)}
                  variant="outline"
                >
                  Salvar e criar outra
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
            <header className="sticky top-0 z-10 mx-auto flex min-h-10 w-full max-w-3xl flex-wrap items-center justify-end gap-1.5 bg-card py-2 sm:gap-2">
              <StudyDetailsButton onClick={() => setDetailsSheetOpen(true)} />
              {!readOnly && (
                <>
                  {question && (
                    <StudyRefineAction
                      disabled={dirty || isPending}
                      onImprove={() => setImprovementOpen(true)}
                    />
                  )}
                  {saveButton}
                </>
              )}
            </header>
            <div className="mx-auto w-full max-w-3xl space-y-6 pt-[clamp(1.5rem,4vh,2.5rem)] pb-8">
              {fields}
            </div>
          </section>
          <StudyItemDetails
            description="Coleção e fontes desta questão."
            onOpenChange={setDetailsSheetOpen}
            open={detailsSheetOpen}
          >
            {details}
          </StudyItemDetails>
        </div>
      )}
      <DiscardStudyItemChangesDialog
        description="O conteúdo da questão ainda não foi salvo."
        onDiscard={() => onOpenChange(false)}
        onOpenChange={setDiscardOpen}
        open={discardOpen}
      />
      {question && (
        <AiMaterialImprovementDialog
          material={{ kind: "quizQuestion", value: question }}
          onApplied={(input) => {
            if (input.kind !== "quizQuestion") return;
            editor.replaceBlocks(editor.document, input.content as LazuliDocumentBlock);
            setOptions(input.options);
            setContentValid(true);
            setTouched(false);
            setDirty(false);
          }}
          onOpenChange={setImprovementOpen}
          open={improvementOpen}
        />
      )}
    </>
  );
};

export const QuizQuestionDialog = (props: Omit<QuizQuestionEditorProps, "presentation">) => (
  <QuizQuestionEditor {...props} presentation="dialog" />
);
export const QuizQuestionPanel = (props: Omit<QuizQuestionEditorProps, "presentation">) => (
  <QuizQuestionEditor {...props} presentation="panel" />
);

const QuizCollectionPicker = ({
  disabled = false,
  autoSelect = false,
  onChange,
  value,
}: {
  autoSelect?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
}) => {
  return (
    <StudyCollectionDestination
      autoSelect={autoSelect}
      kind="quizQuestion"
      disabled={disabled}
      onChange={onChange}
      value={value}
    />
  );
};
