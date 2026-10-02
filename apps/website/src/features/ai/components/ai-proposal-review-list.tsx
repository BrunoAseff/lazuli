import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { cn } from "@/lib/utils.ts";
import { AiQuizProposalEditor, type AiEditableQuizProposal } from "./ai-quiz-proposal-editor.tsx";

export type AiReviewFlashcard = {
  answer: string;
  id: string;
  question: string;
  selected: boolean;
  warning: string | null;
};

export type AiReviewQuiz = AiEditableQuizProposal & {
  id: string;
  selected: boolean;
  warning: string | null;
};

export const AiProposalReviewList = ({
  className,
  flashcards,
  onFlashcardChange,
  onQuizChange,
  onRemove,
  quizQuestions,
}: {
  className?: string;
  flashcards: AiReviewFlashcard[];
  onFlashcardChange: (id: string, change: Partial<AiReviewFlashcard>) => void;
  onQuizChange: (id: string, change: Partial<AiReviewQuiz>) => void;
  onRemove: (id: string, kind: "flashcard" | "quizQuestion") => void;
  quizQuestions: AiReviewQuiz[];
}) => (
  <div className={cn("grid gap-4", className)}>
    {flashcards.map((item, index) => (
      <article
        className={cn(
          "grid gap-4 rounded-[var(--radius)] border p-4 transition-opacity",
          !item.selected && "opacity-55",
        )}
        key={item.id}
      >
        <header className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 font-medium">
            <Checkbox
              checked={item.selected}
              onCheckedChange={(checked) =>
                onFlashcardChange(item.id, { selected: checked === true })
              }
            />
            Flashcard {index + 1}
          </label>
          <Button
            aria-label="Descartar proposta"
            onClick={() => onRemove(item.id, "flashcard")}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Trash2Icon />
          </Button>
        </header>
        <div className="grid gap-2">
          <Label htmlFor={`question-${item.id}`}>Pergunta</Label>
          <Textarea
            id={`question-${item.id}`}
            onChange={(event) => onFlashcardChange(item.id, { question: event.target.value })}
            value={item.question}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`answer-${item.id}`}>Resposta</Label>
          <Textarea
            id={`answer-${item.id}`}
            onChange={(event) => onFlashcardChange(item.id, { answer: event.target.value })}
            value={item.answer}
          />
        </div>
        {item.warning && (
          <p className="flex gap-2 text-xs text-warning-foreground">
            <WarningCircleIcon className="size-4 shrink-0" /> {item.warning}
          </p>
        )}
      </article>
    ))}

    {quizQuestions.map((item, index) => (
      <article
        className={cn(
          "grid gap-4 rounded-[var(--radius)] border p-4 transition-opacity",
          !item.selected && "opacity-55",
        )}
        key={item.id}
      >
        <header className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 font-medium">
            <Checkbox
              checked={item.selected}
              onCheckedChange={(checked) => onQuizChange(item.id, { selected: checked === true })}
            />
            Questão {index + 1}
          </label>
          <Button
            aria-label="Descartar proposta"
            onClick={() => onRemove(item.id, "quizQuestion")}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Trash2Icon />
          </Button>
        </header>
        <AiQuizProposalEditor
          id={item.id}
          onChange={(change) => onQuizChange(item.id, change)}
          value={item}
        />
        {item.warning && (
          <p className="flex gap-2 text-xs text-warning-foreground">
            <WarningCircleIcon className="size-4 shrink-0" /> {item.warning}
          </p>
        )}
      </article>
    ))}
  </div>
);
