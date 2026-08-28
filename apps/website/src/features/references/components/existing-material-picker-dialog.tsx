import {
  FLASHCARD_COLLECTION_MAX_PAGE_SIZE,
  FLASHCARD_PAGE_SIZE,
  REFERENCE_MAX_BATCH_SIZE,
  QUIZ_COLLECTION_MAX_PAGE_SIZE,
  QUIZ_QUESTION_PAGE_SIZE,
  type ReferenceSource,
  type ReferenceTarget,
} from "@lazuli/shared";
import {
  ArrowLeftIcon,
  CheckIcon,
  Layers3Icon,
  LoaderCircleIcon,
  SearchIcon,
  SquareCheckBigIcon,
} from "lucide-react";
import { useMemo, useState, type Ref } from "react";
import { toast } from "sonner";

import { HighlightText } from "@/components/highlight-text.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
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
import { useFlashcardCollections } from "@/features/flashcards/api/flashcard-collection-queries.ts";
import { useFlashcards } from "@/features/flashcards/api/flashcard-queries.ts";
import { useQuizCollections } from "@/features/quizzes/api/quiz-collection-queries.ts";
import { useQuizQuestions } from "@/features/quizzes/api/quiz-queries.ts";
import { cn } from "@/lib/utils.ts";
import { useCreateReferences } from "../api/reference-queries.ts";
import { ReferenceSourcePreview } from "./reference-source-preview.tsx";

type MaterialType = ReferenceTarget["type"];

export const ExistingMaterialPickerDialog = ({
  onCancel,
  onComplete,
  persistDocument,
  source,
  sourcePreview,
}: {
  onCancel: () => void;
  onComplete: () => void;
  persistDocument: () => Promise<boolean>;
  source: ReferenceSource;
  sourcePreview?: string;
}) => {
  const [type, setType] = useState<MaterialType>("flashcard");
  const [collectionId, setCollectionId] = useState<string>();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReferenceTarget[]>([]);
  const create = useCreateReferences();
  const collectionInput = useMemo(
    () => ({
      page: 1,
      pageSize:
        type === "flashcard" ? FLASHCARD_COLLECTION_MAX_PAGE_SIZE : QUIZ_COLLECTION_MAX_PAGE_SIZE,
      project: undefined,
      query,
      status: "active" as const,
    }),
    [query, type],
  );
  const flashcardCollections = useFlashcardCollections(
    collectionInput,
    type === "flashcard" && !collectionId,
  );
  const quizCollections = useQuizCollections(
    collectionInput,
    type === "quizQuestion" && !collectionId,
  );
  const flashcards = useFlashcards(type === "flashcard" ? (collectionId ?? "") : "", {
    filter: "all",
    page: 1,
    pageSize: FLASHCARD_PAGE_SIZE,
    query,
    sort: "updated",
    status: "active",
  });
  const questions = useQuizQuestions(collectionId ?? "", {
    page: 1,
    pageSize: QUIZ_QUESTION_PAGE_SIZE,
    query,
    sort: "updated",
    status: "active",
  });
  const collections =
    type === "flashcard" ? flashcardCollections.data?.items : quizCollections.data?.items;
  const materials = type === "flashcard" ? flashcards.data?.items : questions.data?.items;
  const toggle = (target: ReferenceTarget) =>
    setSelected((current) =>
      current.some(({ id, type: currentType }) => id === target.id && currentType === target.type)
        ? current.filter(
            ({ id, type: currentType }) => id !== target.id || currentType !== target.type,
          )
        : current.length < REFERENCE_MAX_BATCH_SIZE
          ? [...current, target]
          : current,
    );
  const save = async () => {
    if (!selected.length) return;
    try {
      if (!(await persistDocument())) return;
      await create.mutateAsync({
        source,
        targets: selected,
      });
      toast.success(
        selected.length === 1 ? "Material conectado ao trecho." : "Materiais conectados ao trecho.",
      );
      onComplete();
    } catch {
      toast.error("Não foi possível conectar os materiais ao trecho.");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="pr-8 text-xl">Vincular materiais</DialogTitle>
          <DialogDescription>
            {collectionId
              ? "Escolha um ou mais materiais desta coleção."
              : "Escolha o tipo e a coleção que deseja consultar."}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-5 lazuli-thin-scrollbar">
          {sourcePreview && <ReferenceSourcePreview text={sourcePreview} />}
          {!collectionId && (
            <div className="grid grid-cols-2 border p-1">
              <Button
                onClick={() => {
                  setType("flashcard");
                  setQuery("");
                }}
                variant={type === "flashcard" ? "secondary" : "ghost"}
              >
                <Layers3Icon aria-hidden="true" className="size-4" /> Flashcards
              </Button>
              <Button
                onClick={() => {
                  setType("quizQuestion");
                  setQuery("");
                }}
                variant={type === "quizQuestion" ? "secondary" : "ghost"}
              >
                <SquareCheckBigIcon aria-hidden="true" className="size-4" /> Questões
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            {collectionId && (
              <Button
                aria-label="Voltar às coleções"
                onClick={() => {
                  setCollectionId(undefined);
                  setQuery("");
                }}
                size="icon-sm"
                variant="ghost"
              >
                <ArrowLeftIcon aria-hidden="true" />
              </Button>
            )}
            <div className="relative flex-1">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                autoFocus
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={collectionId ? "Pesquisar materiais" : "Pesquisar coleções"}
                value={query}
              />
            </div>
          </div>
          <div className="max-h-72 divide-y overflow-y-auto border-y lazuli-thin-scrollbar">
            {!collectionId &&
              collections?.map((collection) => (
                <button
                  className="flex w-full items-center gap-3 px-2 py-3 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  key={collection.id}
                  onClick={() => {
                    setCollectionId(collection.id);
                    setQuery("");
                  }}
                  type="button"
                >
                  {type === "flashcard" ? (
                    <Layers3Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                  ) : (
                    <SquareCheckBigIcon
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                  )}
                  <OverflowTooltip text={collection.title}>
                    {(ref) => (
                      <span className="min-w-0 flex-1 truncate" ref={ref as Ref<HTMLSpanElement>}>
                        <HighlightText query={query} text={collection.title} />
                      </span>
                    )}
                  </OverflowTooltip>
                </button>
              ))}
            {collectionId &&
              materials?.map((material) => {
                const target: ReferenceTarget = { type, id: material.id };
                const active = selected.some(
                  ({ id, type: selectedType }) => id === material.id && selectedType === type,
                );
                const preview =
                  type === "flashcard" && "questionText" in material
                    ? material.questionText
                    : "contentText" in material
                      ? material.contentText
                      : "Material sem texto";
                return (
                  <button
                    aria-pressed={active}
                    className="flex w-full items-center gap-3 px-2 py-3 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    key={material.id}
                    onClick={() => toggle(target)}
                    type="button"
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center border",
                        active && "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {active && <CheckIcon aria-hidden="true" className="size-3" />}
                    </span>
                    <OverflowTooltip text={preview || "Material sem texto"}>
                      {(ref) => (
                        <span className="min-w-0 flex-1 truncate" ref={ref as Ref<HTMLSpanElement>}>
                          <HighlightText query={query} text={preview || "Material sem texto"} />
                        </span>
                      )}
                    </OverflowTooltip>
                  </button>
                );
              })}
            {((!collectionId && collections?.length === 0) ||
              (collectionId && materials?.length === 0)) && (
              <p className="px-2 py-4 text-sm text-muted-foreground">Nenhum item encontrado.</p>
            )}
          </div>
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-none border-t px-6 py-4">
          <DialogCancelButton onClick={onCancel}>Cancelar</DialogCancelButton>
          <Button disabled={!selected.length || create.isPending} onClick={() => void save()}>
            {create.isPending && <LoaderCircleIcon aria-hidden="true" className="animate-spin" />}
            {!selected.length
              ? "Vincular materiais"
              : selected.length === 1
                ? "Vincular material"
                : `Vincular ${selected.length} materiais`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
