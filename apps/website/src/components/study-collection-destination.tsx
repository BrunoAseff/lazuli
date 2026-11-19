import { useEffect, useId, useRef, useState } from "react";
import {
  FLASHCARD_COLLECTION_MAX_PAGE_SIZE,
  QUIZ_COLLECTION_MAX_PAGE_SIZE,
  type AiMaterialKind,
} from "@lazuli/shared";
import { useFlashcardCollections } from "@/features/flashcards/api/flashcard-collection-queries.ts";
import { useFlashcardCollection } from "@/features/flashcards/api/flashcard-queries.ts";
import {
  useQuizCollection,
  useQuizCollections,
} from "@/features/quizzes/api/quiz-collection-queries.ts";
import { StudyCollectionPicker } from "./study-collection-picker.tsx";
import { AutoHeight } from "./auto-height.tsx";
import { InlineCollectionCreate } from "./inline-collection-create.tsx";
import { Button } from "./ui/button.tsx";
import { PlusIcon } from "./icons.tsx";

/** One destination flow for manual creation and AI; searching never clears the selected title. */
export function StudyCollectionDestination({
  kind,
  value,
  onChange,
  disabled = false,
  autoSelect = false,
  label = "Coleção",
}: {
  kind: AiMaterialKind;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  autoSelect?: boolean;
  /** The field's name, e.g. "Salvar em" where the question is where the new items go. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ id: string; title: string } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasCreating = useRef(false);
  const nameId = useId();
  const flashcards = useFlashcardCollections(
    { page: 1, pageSize: FLASHCARD_COLLECTION_MAX_PAGE_SIZE, query, status: "active" },
    kind === "flashcard",
  );
  const quizzes = useQuizCollections(
    { page: 1, pageSize: QUIZ_COLLECTION_MAX_PAGE_SIZE, query, status: "active" },
    kind === "quizQuestion",
  );
  const flashcardDetail = useFlashcardCollection(kind === "flashcard" ? value : "");
  const quizDetail = useQuizCollection(kind === "quizQuestion" ? value : "");
  const result = kind === "flashcard" ? flashcards : quizzes;
  const detail = kind === "flashcard" ? flashcardDetail : quizDetail;
  const selected = result.data?.items.find(({ id }) => id === value);
  const firstId = result.data?.items[0]?.id;
  useEffect(() => {
    if (autoSelect && !value && !query && firstId) onChange(firstId);
  }, [autoSelect, firstId, onChange, query, value]);
  useEffect(() => {
    if (wasCreating.current && !creating) trigger.current?.focus();
    wasCreating.current = creating;
  }, [creating]);
  const content = creating ? (
    <div className="grid gap-2">
      <label className="text-sm font-medium" data-field-label htmlFor={nameId}>
        Nova coleção
      </label>
      <InlineCollectionCreate
        inputId={nameId}
        kind={kind}
        onCancel={() => setCreating(false)}
        onCreated={(collection) => {
          setCreated(collection);
          onChange(collection.id);
          setCreating(false);
        }}
      />
    </div>
  ) : (
    <div className="grid gap-1">
      <StudyCollectionPicker
        triggerRef={trigger}
        disabled={disabled}
        label={label}
        empty={
          result.isError ? "Não foi possível carregar as coleções." : "Nenhuma coleção encontrada."
        }
        items={result.data?.items ?? []}
        loading={result.isPending}
        onChange={(id) => {
          onChange(id);
          setOpen(false);
          setQuery("");
        }}
        onOpenChange={setOpen}
        onQueryChange={setQuery}
        open={open}
        query={query}
        selectedTitle={
          detail.data?.title ??
          selected?.title ??
          (created?.id === value ? created.title : undefined)
        }
        value={value}
        footer={
          result.isError ? (
            <Button variant="ghost" onClick={() => void result.refetch()}>
              Tentar novamente
            </Button>
          ) : undefined
        }
      />
      {/* A secondary add action: text on the field's edge, no fill (a hover pill would spill past
          the column). Neutral, never a blue text link. */}
      <Button
        className="h-auto w-fit px-0 py-0.5 text-muted-foreground hover:bg-transparent hover:text-foreground aria-expanded:bg-transparent"
        size="xs"
        disabled={disabled}
        variant="ghost"
        onClick={() => setCreating(true)}
      >
        <PlusIcon aria-hidden="true" /> Nova coleção
      </Button>
    </div>
  );
  // The new-collection field takes the picker's place; only the height changes, continuously.
  return (
    <AutoHeight className="-m-1">
      <div className="p-1">{content}</div>
    </AutoHeight>
  );
}
