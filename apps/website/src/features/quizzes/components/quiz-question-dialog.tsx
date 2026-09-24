import { useCreateBlockNote } from "@blocknote/react";
import {
  QUIZ_COLLECTION_MAX_PAGE_SIZE,
  quizQuestionContentSchema,
  type QuizQuestionDetail,
} from "@lazuli/shared";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  CircleIcon,
  CopyIcon,
  LoaderCircleIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { StudyCollectionPicker } from "@/components/study-collection-picker.tsx";
import {
  DiscardStudyItemChangesDialog,
  StudyItemActionsPanel,
  StudyItemDetails,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
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
import { cn } from "@/lib/utils.ts";
import type { StudyItemAction } from "@/lib/study-actions.ts";
import type { StudyEditorPresentation } from "@/lib/study-editor.ts";
import { useQuizCollections } from "../api/quiz-collection-queries.ts";
import { uploadQuizImage } from "../api/quiz-api.ts";
import { useCreateQuizQuestion, useUpdateQuizQuestion } from "../api/quiz-queries.ts";
import { QuizCollectionDialog } from "./quiz-collection-dialogs.tsx";

type Option = { id: string; text: string; isCorrect: boolean };
const normalizeOptionText = (text: string) => text.trim().toLocaleLowerCase("pt-BR");

const newOptions = (): Option[] => [
  { id: crypto.randomUUID(), text: "", isCorrect: true },
  { id: crypto.randomUUID(), text: "", isCorrect: false },
];

type QuizQuestionEditorProps = {
  collectionId?: string;
  initialContent?: LazuliDocumentBlock | QuizQuestionDetail["content"];
  initialOptions?: Option[];
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
}: QuizQuestionEditorProps) => {
  const [targetCollectionId, setTargetCollectionId] = useState(
    question?.collectionId ?? collectionId ?? "",
  );
  const [options, setOptions] = useState<Option[]>(
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
  const duplicateOptionIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { text } of options) {
      const normalized = normalizeOptionText(text);
      if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
    return new Set(
      options
        .filter(({ text }) => {
          const normalized = normalizeOptionText(text);
          return normalized && (counts.get(normalized) ?? 0) > 1;
        })
        .map(({ id }) => id),
    );
  }, [options]);
  const hasValidOptionCount = options.length >= 2 && options.length <= 6;
  const hasEmptyOption = options.some(({ text }) => !text.trim());
  const hasSingleCorrectOption = options.filter(({ isCorrect }) => isCorrect).length === 1;
  const optionsValid =
    hasValidOptionCount &&
    !hasEmptyOption &&
    hasSingleCorrectOption &&
    duplicateOptionIds.size === 0;
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
          toast.warning("Questão criada, mas a referência não pôde ser adicionada.");
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
      disabled={readOnly}
      value={targetCollectionId}
      onChange={(value) => {
        setTargetCollectionId(value);
        setDirty(true);
      }}
    />
  );
  const alternatives = (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-medium">Alternativas</legend>
      {options.map((option, index) => {
        const duplicated = duplicateOptionIds.has(option.id);
        const errorId = `quiz-option-${option.id}-error`;
        return (
          <div
            className="grid gap-x-2 rounded-lg border bg-background p-2 sm:grid-cols-[minmax(0,1fr)_auto]"
            key={option.id}
          >
            <div className="min-w-0">
              <Input
                aria-describedby={duplicated ? errorId : undefined}
                aria-invalid={duplicated}
                aria-label={`Alternativa ${index + 1}`}
                disabled={readOnly}
                maxLength={1000}
                onChange={(event) => {
                  setDirty(true);
                  setOptions((current) =>
                    current.map((item) =>
                      item.id === option.id ? { ...item, text: event.target.value } : item,
                    ),
                  );
                }}
                placeholder={`Alternativa ${index + 1}`}
                value={option.text}
              />
              <div
                aria-live="polite"
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-150 ease-out",
                  duplicated ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <p className="min-h-0 overflow-hidden pt-1 text-xs text-destructive" id={errorId}>
                  Esta alternativa está repetida.
                </p>
              </div>
            </div>
            <div className="flex h-9 items-center justify-end gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={
                      option.isCorrect ? "Resposta correta" : "Marcar como resposta correta"
                    }
                    aria-pressed={option.isCorrect}
                    className={cn(
                      option.isCorrect &&
                        "border-success/60 bg-success/5 text-success hover:border-success/70 hover:bg-success/15 hover:text-success",
                    )}
                    disabled={readOnly}
                    onClick={() => {
                      setDirty(true);
                      setOptions((current) =>
                        current.map((item) => ({
                          ...item,
                          isCorrect: item.id === option.id,
                        })),
                      );
                    }}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                  >
                    {option.isCorrect ? <CheckCircle2Icon /> : <CircleIcon />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {option.isCorrect ? "Resposta correta" : "Marcar como correta"}
                </TooltipContent>
              </Tooltip>
              <Button
                aria-label={`Mover alternativa ${index + 1} para cima`}
                disabled={readOnly || index === 0}
                onClick={() => {
                  setDirty(true);
                  setOptions((current) => {
                    const next = [...current];
                    [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                    return next;
                  });
                }}
                size="icon-sm"
                variant="ghost"
              >
                <ArrowUpIcon />
              </Button>
              <Button
                aria-label={`Mover alternativa ${index + 1} para baixo`}
                disabled={readOnly || index === options.length - 1}
                onClick={() => {
                  setDirty(true);
                  setOptions((current) => {
                    const next = [...current];
                    [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
                    return next;
                  });
                }}
                size="icon-sm"
                variant="ghost"
              >
                <ArrowDownIcon />
              </Button>
              <Button
                aria-label={`Remover alternativa ${index + 1}`}
                disabled={readOnly || options.length <= 2}
                onClick={() => {
                  setDirty(true);
                  setOptions((current) => current.filter(({ id }) => id !== option.id));
                }}
                size="icon-sm"
                variant="ghost"
              >
                <Trash2Icon />
              </Button>
            </div>
          </div>
        );
      })}
      {touched && (!hasValidOptionCount || hasEmptyOption || !hasSingleCorrectOption) && (
        <p className="text-xs text-destructive" role="alert">
          Preencha de duas a seis alternativas e marque uma única resposta correta.
        </p>
      )}
      {!readOnly && (
        <Button
          className="h-11 w-full border-dashed hover:border-primary hover:bg-primary/5 hover:text-primary"
          disabled={options.length >= 6}
          onClick={() => {
            setDirty(true);
            setOptions((current) => [
              ...current,
              { id: crypto.randomUUID(), text: "", isCorrect: false },
            ]);
          }}
          variant="outline"
        >
          <PlusIcon /> Adicionar alternativa
        </Button>
      )}
    </fieldset>
  );
  const fields = (
    <>
      {sourcePreview && <ReferenceSourcePreview text={sourcePreview} />}
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
      {isPending && <LoaderCircleIcon className="animate-spin" />} Salvar
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
        <StudyItemActionsPanel archived={Boolean(question.archivedAt)} onAction={onAction} />
      )}
    </>
  );
  return (
    <>
      {presentation === "dialog" ? (
        <Dialog open={open} onOpenChange={(next) => !next && requestClose()}>
          <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl">
            <DialogHeader className="border-b px-6 py-5">
              <DialogTitle className="pr-8 text-xl">
                {question ? "Editar questão" : "Nova questão"}
              </DialogTitle>
              <DialogDescription>
                Crie a pergunta e marque uma única resposta correta.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 space-y-6 overflow-y-auto px-6 py-6 lazuli-thin-scrollbar">
              {collectionPicker}
              {fields}
              {question && (
                <ReferenceManager
                  disabled={dirty}
                  returnTo={`/quizzes/${question.collectionId}?question=${question.id}`}
                  target={{ type: "quizQuestion", id: question.id }}
                />
              )}
            </div>
            <DialogFooter className="mx-0 mb-0 border-t px-6 py-4">
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
              {saveButton}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <div className="grid min-h-0 flex-1 bg-card xl:grid-cols-[minmax(0,1fr)_18.5rem]">
          <section className="flex min-h-0 min-w-0 flex-col overflow-y-auto px-5 py-5 lazuli-thin-scrollbar sm:px-8 lg:px-10">
            <header className="mx-auto flex min-h-10 w-full max-w-3xl justify-end">
              <Button
                className="xl:hidden"
                onClick={() => setDetailsSheetOpen(true)}
                size="sm"
                variant="outline"
              >
                <SlidersHorizontalIcon /> Detalhes
              </Button>
            </header>
            <div className="mx-auto w-full max-w-3xl space-y-8 pt-[clamp(2rem,5vh,4rem)] pb-12">
              {fields}
              {!readOnly && (
                <div className="flex justify-end gap-2">
                  {question && onAction && (
                    <Button
                      disabled={dirty}
                      onClick={() => onAction("duplicate")}
                      variant="outline"
                    >
                      <CopyIcon /> Duplicar
                    </Button>
                  )}
                  {saveButton}
                </div>
              )}
            </div>
          </section>
          <StudyItemDetails
            description="Organização e referências desta questão."
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
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
}) => {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const input = useMemo(
    () => ({
      page: 1,
      pageSize: QUIZ_COLLECTION_MAX_PAGE_SIZE,
      project: undefined,
      query,
      status: "active" as const,
    }),
    [query],
  );
  const collections = useQuizCollections(input);
  const selected = collections.data?.items.find(({ id }) => id === value);
  return (
    <div>
      <StudyCollectionPicker
        disabled={disabled}
        empty="Nenhuma coleção encontrada."
        footer={
          <div className="mt-1 border-t pt-1">
            <Button
              className="w-full justify-start"
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
              variant="ghost"
            >
              <PlusIcon /> Criar nova coleção
            </Button>
          </div>
        }
        items={collections.data?.items ?? []}
        loading={collections.isPending}
        onChange={(collectionId) => {
          onChange(collectionId);
          setOpen(false);
        }}
        onOpenChange={setOpen}
        onQueryChange={setQuery}
        open={open}
        query={query}
        selectedTitle={selected?.title}
        value={value}
      />
      <QuizCollectionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(collection) => {
          onChange(collection.id);
          setCreateOpen(false);
        }}
      />
    </div>
  );
};
