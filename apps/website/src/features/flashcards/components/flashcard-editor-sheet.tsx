import { useCreateBlockNote } from "@blocknote/react";
import {
  FLASHCARD_COLLECTION_MAX_PAGE_SIZE,
  flashcardContentSchema,
  type FlashcardDetail,
} from "@lazuli/shared";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  LoaderCircleIcon,
  MoveRightIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
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
import { cn } from "@/lib/utils.ts";
import { useFlashcardCollections } from "../api/flashcard-collection-queries.ts";
import { uploadFlashcardImage } from "../api/flashcard-api.ts";
import { useCreateFlashcard, useUpdateFlashcard } from "../api/flashcard-queries.ts";
import { getFlashcardCollectionErrorMessage } from "../flashcard-messages.ts";

type FlashcardEditorProps = {
  card?: FlashcardDetail;
  collectionId?: string;
  initialQuestion?: LazuliDocumentBlock;
  onCreated?: (cardId: string) => void | boolean | Promise<void | boolean>;
  onAction?: (action: "archive" | "delete" | "move" | "restore") => void;
  onOpenChange: (open: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: (cardId: string, collectionId: string) => void;
  open: boolean;
  presentation: "dialog" | "panel";
  readOnly?: boolean;
  sourcePreview?: string;
};

const FlashcardEditor = ({
  card,
  collectionId,
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
}: FlashcardEditorProps) => {
  const [targetCollectionId, setTargetCollectionId] = useState(
    card?.collectionId ?? collectionId ?? "",
  );
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ answer?: string; question?: string }>({});
  const createdUrls = useRef(new Set<string>());
  const committed = useRef(false);
  const create = useCreateFlashcard(targetCollectionId);
  const update = useUpdateFlashcard(collectionId ?? targetCollectionId, card?.id ?? "");
  const initialQuestionKey = JSON.stringify(initialQuestion ?? null);
  const question = useCreateBlockNote(
    {
      schema: documentSchema,
      initialContent: (card?.question as LazuliDocumentBlock | undefined) ?? initialQuestion,
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
      initialContent: card?.answer as LazuliDocumentBlock | undefined,
      dictionary: lazuliBlockNoteDictionary,
      uploadFile: async (file) => {
        const uploaded = await uploadFlashcardImage(file);
        createdUrls.current.add(uploaded.url);
        return uploaded.url;
      },
      resolveFileUrl: resolveAssetUrl,
    },
    [card?.id],
  );
  const [questionValid, setQuestionValid] = useState(Boolean(card));
  const [answerValid, setAnswerValid] = useState(Boolean(card));

  useEffect(() => {
    committed.current = false;
    return () => {
      releaseResolvedAssetUrls();
      if (!committed.current) void cleanupAssets([...createdUrls.current]);
    };
  }, []);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

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
          toast.warning("Flashcard criado, mas a referência não pôde ser adicionada.");
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
      disabled={readOnly}
      value={targetCollectionId}
      onChange={(value) => {
        setTargetCollectionId(value);
        setDirty(true);
      }}
    />
  );
  const fields = (
    <>
      {sourcePreview && <ReferenceSourcePreview text={sourcePreview} />}
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
      {isPending && <LoaderCircleIcon aria-hidden="true" className="animate-spin" />}
      Salvar
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
        <section className="border-t pt-6">
          <p className="mb-3 text-[0.6875rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
            Ações
          </p>
          <div className="grid grid-cols-2 gap-2">
            {!card.archivedAt && (
              <Button
                className="h-9 justify-start"
                onClick={() => onAction("move")}
                variant="outline"
              >
                <MoveRightIcon /> Mover
              </Button>
            )}
            <Button
              className={cn("h-9 justify-start", card.archivedAt && "col-span-2")}
              onClick={() => onAction(card.archivedAt ? "restore" : "archive")}
              variant="outline"
            >
              {card.archivedAt ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
              {card.archivedAt ? "Restaurar" : "Arquivar"}
            </Button>
            <Button
              className="col-span-2 h-9 justify-start text-destructive hover:text-destructive"
              onClick={() => onAction("delete")}
              variant="outline"
            >
              <Trash2Icon /> Excluir
            </Button>
          </div>
        </section>
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
                {card ? "Editar flashcard" : "Novo flashcard"}
              </DialogTitle>
              <DialogDescription>
                Escreva uma pergunta clara e uma resposta objetiva.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 space-y-7 overflow-y-auto px-6 py-6 lazuli-thin-scrollbar">
              {collectionPicker}
              {fields}
              {card && (
                <ReferenceManager
                  disabled={dirty}
                  returnTo={`/flashcards/${card.collectionId}?card=${card.id}`}
                  target={{ type: "flashcard", id: card.id }}
                />
              )}
            </div>
            <DialogFooter className="mx-0 mb-0 border-t px-6 py-4 sm:flex-row sm:justify-end">
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
              {saveButton}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <div className="grid min-h-0 flex-1 bg-card xl:grid-cols-[minmax(0,1fr)_18.5rem]">
          <section className="flex min-h-0 min-w-0 flex-col overflow-y-auto px-5 py-5 lazuli-thin-scrollbar sm:px-8 lg:px-10">
            <header className="mx-auto flex min-h-10 w-full max-w-3xl items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 text-[0.6875rem] text-muted-foreground">
                <span className="rounded-md bg-muted px-2 py-1">
                  {card?.srsState === "new"
                    ? "Novo"
                    : card?.srsState === "review"
                      ? "Revisão"
                      : "Aprendendo"}
                </span>
                {card && (
                  <span className="rounded-md bg-muted px-2 py-1">
                    {card.dueAt <= new Date().toISOString() ? "Disponível agora" : "Agendado"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  className="xl:hidden"
                  onClick={() => setDetailsSheetOpen(true)}
                  size="sm"
                  variant="outline"
                >
                  <SlidersHorizontalIcon aria-hidden="true" /> Detalhes
                </Button>
              </div>
            </header>
            <div className="mx-auto w-full max-w-3xl pt-[clamp(2.5rem,7vh,5rem)] pb-12">
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
                <span className="h-px bg-border" />
                <span className="text-[0.6875rem] tracking-[0.14em] text-muted-foreground uppercase">
                  Resposta
                </span>
                <span className="h-px bg-border" />
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
              {!readOnly && <div className="mt-8 flex justify-end">{saveButton}</div>}
            </div>
          </section>
          <Sheet open={detailsSheetOpen} onOpenChange={setDetailsSheetOpen}>
            <SheetContent className="w-[min(24rem,calc(100vw-1rem))] overflow-y-auto p-0 lazuli-thin-scrollbar">
              <SheetHeader className="border-b px-5 py-5">
                <SheetTitle>Detalhes</SheetTitle>
                <SheetDescription>Organização e referências deste flashcard.</SheetDescription>
              </SheetHeader>
              <div className="px-5 pb-6">{details}</div>
            </SheetContent>
          </Sheet>
          <aside className="hidden min-h-0 overflow-y-auto border-l bg-background px-5 py-5 lazuli-thin-scrollbar xl:block">
            <h2 className="mb-6 font-heading text-xl font-normal">Detalhes</h2>
            {details}
          </aside>
        </div>
      )}
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>O conteúdo ainda não foi salvo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => onOpenChange(false)} variant="destructive">
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  value,
  onChange,
}: {
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const input = useMemo(
    () => ({
      page: 1,
      pageSize: FLASHCARD_COLLECTION_MAX_PAGE_SIZE,
      project: undefined,
      query,
      status: "active" as const,
    }),
    [query],
  );
  const collections = useFlashcardCollections(input);
  const selected = collections.data?.items.find(({ id }) => id === value);
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">Coleção</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button className="w-full justify-between" disabled={disabled} variant="outline">
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected?.title ?? "Selecionar coleção"}
            </span>
            <ChevronsUpDownIcon aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <div className="relative border-b p-2">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar coleções"
              value={query}
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1 lazuli-thin-scrollbar">
            {collections.data?.items.map((collection) => (
              <button
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-muted",
                  collection.id === value && "bg-muted",
                )}
                key={collection.id}
                onClick={() => {
                  onChange(collection.id);
                  setOpen(false);
                }}
                type="button"
              >
                <span className="truncate">{collection.title}</span>
                {collection.id === value && <CheckIcon className="size-4" />}
              </button>
            ))}
            {!collections.isPending && !collections.data?.items.length && (
              <p className="p-3 text-sm text-muted-foreground">Nenhuma coleção encontrada.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
