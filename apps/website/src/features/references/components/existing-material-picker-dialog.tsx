import {
  FLASHCARD_COLLECTION_MAX_PAGE_SIZE,
  FLASHCARD_PAGE_SIZE,
  REFERENCE_MAX_BATCH_SIZE,
  QUIZ_COLLECTION_MAX_PAGE_SIZE,
  QUIZ_QUESTION_PAGE_SIZE,
  type ReferenceSource,
  type ReferenceTarget,
} from "@lazuli/shared";
import { ArrowLeftIcon, CheckIcon, Layers3Icon, SquareCheckBigIcon } from "@/components/icons.tsx";
import { useMemo, useState, type Ref } from "react";
import { toast } from "sonner";

import { HighlightText } from "@/components/highlight-text.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { SearchInput } from "@/components/search-input.tsx";
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
import { useFlashcardCollections } from "@/features/flashcards/api/flashcard-collection-queries.ts";
import { useFlashcards } from "@/features/flashcards/api/flashcard-queries.ts";
import { useQuizCollections } from "@/features/quizzes/api/quiz-collection-queries.ts";
import { useQuizQuestions } from "@/features/quizzes/api/quiz-queries.ts";
import { cn } from "@/lib/utils.ts";
import { useCreateReferences } from "../api/reference-queries.ts";
import { CreationWorkspace } from "@/features/ai/components/creation-workspace.tsx";
import { MaterialKindPicker } from "@/features/ai/components/material-kind-picker.tsx";

type MaterialType = ReferenceTarget["type"];

export const ExistingMaterialPickerDialog = ({
  onCancel,
  onComplete,
  persistDocument,
  source,
  sourceTitle,
  sourcePreview,
}: {
  onCancel: () => void;
  onComplete: () => void;
  persistDocument: () => Promise<boolean>;
  source: ReferenceSource;
  sourceTitle?: string;
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="px-6 py-5">
          <DialogTitle className="pr-8">Conectar flashcards ou questões</DialogTitle>
          <DialogDescription>
            {collectionId
              ? "Escolha um ou mais materiais desta coleção."
              : "Escolha o tipo e a coleção que deseja consultar."}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-6 lazuli-thin-scrollbar">
          <CreationWorkspace
            sourceControls
            composing
            destinationLabel="Escolher materiais"
            source={
              // Two groups, as in the other creation dialogs: what is being connected (the source and
              // its extent together), then the one choice, with its own visible label.
              <div className="grid gap-6">
                <div className="grid gap-1">
                  {sourceTitle && <h3 className="mb-0! leading-snug">{sourceTitle}</h3>}
                  {sourcePreview ? (
                    <blockquote className="mt-1">{sourcePreview}</blockquote>
                  ) : (
                    <p className="mb-0!" data-source-label>
                      Documento inteiro
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <p className="font-sans text-[0.8125rem] font-medium">Tipo de material</p>
                  <MaterialKindPicker
                    label="Tipo de material"
                    value={type}
                    onChange={(next) => {
                      setType(next);
                      setCollectionId(undefined);
                      setQuery("");
                      // What was picked belongs to the other kind: nothing stays selected.
                      setSelected([]);
                    }}
                  />
                </div>
              </div>
            }
          >
            <div className="space-y-4">
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
                <SearchInput
                  autoFocus
                  containerClassName="flex-1"
                  onValueChange={setQuery}
                  placeholder={collectionId ? "Pesquisar materiais" : "Pesquisar coleções"}
                  value={query}
                />
              </div>
              <div className="max-h-72 min-w-0 space-y-1 overflow-x-hidden overflow-y-auto rounded-[var(--radius)] border border-input bg-card p-1.5 lazuli-thin-scrollbar">
                {!collectionId &&
                  collections?.map((collection) => (
                    <button
                      className="flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
                          <span
                            className="min-w-0 flex-1 truncate"
                            ref={ref as Ref<HTMLSpanElement>}
                          >
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
                        className={cn(
                          "flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                          active && "bg-[var(--primary-soft)] hover:bg-[var(--primary-soft)]",
                        )}
                        key={material.id}
                        onClick={() => toggle(target)}
                        type="button"
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-[0.3rem] border border-input bg-card",
                            active && "border-action bg-action text-action-foreground",
                          )}
                        >
                          {active && <CheckIcon aria-hidden="true" className="size-3" />}
                        </span>
                        <OverflowTooltip text={preview || "Material sem texto"}>
                          {(ref) => (
                            <span
                              className="min-w-0 flex-1 truncate"
                              ref={ref as Ref<HTMLSpanElement>}
                            >
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
          </CreationWorkspace>
        </div>
        <DialogFooter className="mx-0 mb-0 px-6 py-4">
          <DialogCancelButton onClick={onCancel}>Cancelar</DialogCancelButton>
          <Button
            pending={create.isPending}
            disabled={!selected.length || create.isPending}
            onClick={() => void save()}
          >
            {!selected.length
              ? "Conectar materiais"
              : selected.length === 1
                ? "Conectar material"
                : `Conectar ${selected.length} materiais`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
