import { useRef, useState } from "react";
import { studyCollectionTitleSchema, type AiMaterialKind } from "@lazuli/shared";
import { toast } from "sonner";
import { Button } from "./ui/button.tsx";
import { Input } from "./ui/input.tsx";
import { motion, useReducedMotion } from "motion/react";
import { useCreateFlashcardCollection } from "@/features/flashcards/api/flashcard-collection-queries.ts";
import { useCreateQuizCollection } from "@/features/quizzes/api/quiz-collection-queries.ts";

/** Create a destination without leaving a document or stacking another modal. */
export function InlineCollectionCreate({
  kind,
  onCreated,
  onCancel,
  inputId = "new-collection-name",
}: {
  kind: AiMaterialKind;
  onCreated: (collection: { id: string; title: string }) => void;
  onCancel: () => void;
  inputId?: string;
}) {
  const reduced = useReducedMotion();
  const [title, setTitle] = useState("");
  const id = useRef(crypto.randomUUID());
  const inFlight = useRef(false);
  const flashcard = useCreateFlashcardCollection();
  const quiz = useCreateQuizCollection();
  const pending = flashcard.isPending || quiz.isPending;
  const parsed = studyCollectionTitleSchema.safeParse(title);
  const create = async () => {
    if (!parsed.success || pending || inFlight.current) return;
    inFlight.current = true;
    try {
      const input = { id: id.current, title: parsed.data, projectId: null };
      const result =
        kind === "flashcard" ? await flashcard.mutateAsync(input) : await quiz.mutateAsync(input);
      onCreated(result);
    } catch {
      toast.error("Não foi possível criar a coleção. Tente novamente.");
    } finally {
      inFlight.current = false;
    }
  };
  return (
    <motion.div
      data-local-escape
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
      className="grid gap-3"
    >
      <Input
        autoFocus
        id={inputId}
        aria-label="Nome da nova coleção"
        placeholder="Nome da coleção"
        value={title}
        maxLength={100}
        disabled={pending}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !pending) {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
          if (event.key === "Enter") {
            event.preventDefault();
            void create();
          }
        }}
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          size="sm"
          className="whitespace-normal"
          disabled={!parsed.success}
          onClick={() => void create()}
          pending={pending}
        >
          Criar e selecionar
        </Button>
      </div>
    </motion.div>
  );
}
