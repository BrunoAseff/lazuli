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
  CheckIcon,
  CircleIcon,
  ChevronsUpDownIcon,
  LoaderCircleIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import { cleanupAssets, collectAssetUrls } from "@/features/assets/rich-content-assets.ts";
import { resolveAssetUrl, releaseResolvedAssetUrls } from "@/features/assets/asset-api.ts";
import { lazuliBlockNoteDictionary } from "@/features/documents/editor/blocknote-dictionary.ts";
import {
  documentSchema,
  type LazuliDocumentBlock,
} from "@/features/documents/editor/document-schema.tsx";
import { RichContentField } from "@/components/rich-content-field.tsx";
import { cn } from "@/lib/utils.ts";
import { useQuizCollections } from "../api/quiz-collection-queries.ts";
import { uploadQuizImage } from "../api/quiz-api.ts";
import { useCreateQuizQuestion, useUpdateQuizQuestion } from "../api/quiz-queries.ts";
import { QuizCollectionDialog } from "./quiz-collection-dialogs.tsx";

type Option = { id: string; text: string; isCorrect: boolean };
const newOptions = (): Option[] => [
  { id: crypto.randomUUID(), text: "", isCorrect: true },
  { id: crypto.randomUUID(), text: "", isCorrect: false },
];

export const QuizQuestionDialog = ({
  collectionId,
  onOpenChange,
  open,
  question,
}: {
  collectionId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  question?: QuizQuestionDetail;
}) => {
  const [targetCollectionId, setTargetCollectionId] = useState(
    question?.collectionId ?? collectionId,
  );
  const [options, setOptions] = useState<Option[]>(
    question?.options.map(({ id, isCorrect, text }) => ({ id, isCorrect, text })) ?? newOptions(),
  );
  const [contentValid, setContentValid] = useState(Boolean(question));
  const [touched, setTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const createdUrls = useRef(new Set<string>());
  const committed = useRef(false);
  const create = useCreateQuizQuestion(targetCollectionId);
  const update = useUpdateQuizQuestion(collectionId, question?.id ?? "");
  const editor = useCreateBlockNote(
    {
      schema: documentSchema,
      initialContent: question?.content as LazuliDocumentBlock | undefined,
      dictionary: lazuliBlockNoteDictionary,
      uploadFile: async (file) => {
        const uploaded = await uploadQuizImage(file);
        createdUrls.current.add(uploaded.url);
        return uploaded.url;
      },
      resolveFileUrl: resolveAssetUrl,
    },
    [question?.id],
  );
  useEffect(
    () => () => {
      releaseResolvedAssetUrls();
      if (!committed.current) void cleanupAssets([...createdUrls.current]);
    },
    [],
  );
  const optionsValid =
    options.length >= 2 &&
    options.length <= 6 &&
    options.every(({ text }) => text.trim()) &&
    options.filter(({ isCorrect }) => isCorrect).length === 1 &&
    new Set(options.map(({ text }) => text.trim().toLocaleLowerCase("pt-BR"))).size ===
      options.length;
  const requestClose = () => {
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
            question.options.map(({ id, isCorrect, text }) => ({ id, isCorrect, text })),
          );
        const sameCollection = targetCollectionId === question.collectionId;
        if (sameContent && sameOptions && sameCollection) {
          committed.current = true;
          onOpenChange(false);
          return;
        }
        await update.mutateAsync({
          ...(!sameContent && { content: parsed.data }),
          ...(!sameOptions && { options: normalizedOptions }),
          ...(!sameCollection && { collectionId: targetCollectionId }),
        });
      } else
        await create.mutateAsync({
          id: crypto.randomUUID(),
          content: parsed.data,
          options: normalizedOptions,
        });
      committed.current = true;
      createdUrls.current.clear();
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
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar a questão.");
    }
  };
  return (
    <>
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
          <div className="min-h-0 space-y-6 overflow-y-auto px-6 py-6 subtle-scrollbar">
            <QuizCollectionPicker
              value={targetCollectionId}
              onChange={(value) => {
                setTargetCollectionId(value);
                setDirty(true);
              }}
            />
            <RichContentField
              editor={editor}
              error={touched && !contentValid ? "Informe uma pergunta." : undefined}
              label="Pergunta"
              onChange={() => {
                setContentValid(quizQuestionContentSchema.safeParse(editor.document).success);
                setDirty(true);
              }}
            />
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-medium">Alternativas</legend>
              {options.map((option, index) => (
                <div
                  className="grid gap-2 border p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                  key={option.id}
                >
                  <Input
                    aria-label={`Alternativa ${index + 1}`}
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
                  <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          aria-label={
                            option.isCorrect ? "Resposta correta" : "Marcar como resposta correta"
                          }
                          aria-pressed={option.isCorrect}
                          className={cn(
                            "mr-auto sm:mr-2",
                            option.isCorrect &&
                              "border-emerald-700 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
                          )}
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
                        {option.isCorrect ? "Resposta correta" : "Marcar como resposta correta"}
                      </TooltipContent>
                    </Tooltip>
                    <Button
                      aria-label={`Mover alternativa ${index + 1} para cima`}
                      disabled={index === 0}
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
                      disabled={index === options.length - 1}
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
                      disabled={options.length <= 2}
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
              ))}
              {touched && !optionsValid && (
                <p className="text-xs text-destructive" role="alert">
                  Preencha de duas a seis alternativas diferentes e marque uma correta.
                </p>
              )}
              <Button
                className="h-11 w-full border-dashed"
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
                <PlusIcon /> Adicionar outra alternativa
              </Button>
            </fieldset>
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-none border-t px-6 py-4">
            <DialogCancelButton
              disabled={create.isPending || update.isPending}
              onClick={requestClose}
            >
              Cancelar
            </DialogCancelButton>
            {!question && (
              <Button
                disabled={create.isPending || !contentValid || !optionsValid}
                onClick={() => void save(true)}
                variant="outline"
              >
                Salvar e criar outra
              </Button>
            )}
            <Button
              disabled={create.isPending || update.isPending || !contentValid || !optionsValid}
              onClick={() => void save()}
            >
              {(create.isPending || update.isPending) && (
                <LoaderCircleIcon className="animate-spin" />
              )}{" "}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              O conteúdo da questão ainda não foi salvo.
            </AlertDialogDescription>
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

const QuizCollectionPicker = ({
  onChange,
  value,
}: {
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
      <label className="mb-2 block text-sm font-medium">Coleção</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button className="w-full justify-between rounded-none" variant="outline">
            <span className="truncate">{selected?.title ?? "Coleção atual"}</span>
            <ChevronsUpDownIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) rounded-none p-0"
        >
          <div className="relative border-b p-2">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar coleções"
              value={query}
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1 subtle-scrollbar">
            {collections.data?.items.map((collection) => (
              <button
                className={cn(
                  "flex w-full items-center justify-between px-2 py-2 text-left text-sm hover:bg-muted",
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
          </div>
        </PopoverContent>
      </Popover>
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
