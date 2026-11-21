import { FormFieldError } from "@/components/form-field-error.tsx";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "@/components/icons.tsx";
import { useId, useMemo, useState } from "react";

import { ConfirmationDialog } from "@/components/confirmation-dialog.tsx";
import { ChoiceSeal } from "@/components/study-answer-choice.tsx";
import "./quiz-alternatives-field.css";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";

export type QuizOptionDraft = { id: string; text: string; isCorrect: boolean };

const normalizeOptionText = (text: string) => text.trim().toLocaleLowerCase("pt-BR");

export const hasDuplicateQuizOptionTexts = (options: string[]) => {
  const normalized = options.map(normalizeOptionText).filter(Boolean);
  return new Set(normalized).size !== normalized.length;
};

export const getDuplicateQuizOptionIds = (options: QuizOptionDraft[]) => {
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
};

export const quizOptionsAreValid = (options: QuizOptionDraft[]) =>
  options.length >= 2 &&
  options.length <= 6 &&
  options.every(({ text }) => text.trim()) &&
  options.filter(({ isCorrect }) => isCorrect).length === 1 &&
  getDuplicateQuizOptionIds(options).size === 0;

export const QuizAlternativesField = ({
  onChange,
  options,
  readOnly = false,
  touched = false,
}: {
  onChange: (options: QuizOptionDraft[]) => void;
  options: QuizOptionDraft[];
  readOnly?: boolean;
  touched?: boolean;
}) => {
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const optionToRemove = options.find(({ id }) => id === pendingRemoval);
  const duplicateOptionIds = useMemo(() => getDuplicateQuizOptionIds(options), [options]);
  const hasValidOptionCount = options.length >= 2 && options.length <= 6;
  const hasEmptyOption = options.some(({ text }) => !text.trim());
  const hasSingleCorrectOption = options.filter(({ isCorrect }) => isCorrect).length === 1;
  const headingId = useId();

  return (
    <fieldset aria-labelledby={headingId} className="space-y-2">
      {/* The add action lives with the heading, so it is visible before the list, however long. */}
      <div className="flex min-h-8 items-center justify-between gap-3">
        <span className="text-sm font-medium" id={headingId}>
          Alternativas
        </span>
        {!readOnly && (
          <Button
            disabled={options.length >= 6}
            onClick={() =>
              onChange([...options, { id: crypto.randomUUID(), text: "", isCorrect: false }])
            }
            className="w-fit"
            size="xs"
            type="button"
            variant="field-link"
          >
            <PlusIcon aria-hidden="true" /> Nova alternativa
          </Button>
        )}
      </div>
      {options.map((option, index) => {
        const duplicated = duplicateOptionIds.has(option.id);
        const errorId = `quiz-option-${option.id}-error`;
        return (
          <div
            className="alternative-row"
            data-correct={option.isCorrect || undefined}
            key={option.id}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label={
                    option.isCorrect
                      ? `Alternativa ${index + 1}: resposta correta`
                      : `Marcar alternativa ${index + 1} como correta`
                  }
                  aria-pressed={option.isCorrect}
                  className="alternative-seal"
                  disabled={readOnly}
                  onClick={() =>
                    onChange(
                      options.map((item) => ({
                        ...item,
                        isCorrect: item.id === option.id,
                      })),
                    )
                  }
                  type="button"
                >
                  <ChoiceSeal
                    filled={false}
                    index={index}
                    outcome={option.isCorrect ? "correct" : undefined}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {option.isCorrect ? "Resposta correta" : "Marcar como correta"}
              </TooltipContent>
            </Tooltip>
            <div className="min-w-0">
              <Textarea
                data-quiz-alternative
                className="min-h-0 resize-none border-transparent bg-transparent px-2 py-1 text-sm leading-6 shadow-none [field-sizing:content] hover:border-input focus-visible:bg-card"
                rows={1}
                aria-describedby={duplicated ? errorId : undefined}
                aria-invalid={duplicated}
                aria-label={`Alternativa ${index + 1}`}
                maxLength={1000}
                onChange={(event) =>
                  onChange(
                    options.map((item) =>
                      item.id === option.id ? { ...item, text: event.target.value } : item,
                    ),
                  )
                }
                placeholder={`Alternativa ${index + 1}`}
                readOnly={readOnly}
                value={option.text}
              />
              <FormFieldError
                id={errorId}
                inGrid={false}
                message={duplicated ? "Esta alternativa está repetida." : undefined}
              />
            </div>
            {/* One row of equal controls aligned to the first line of the answer. */}
            <div className="flex items-center gap-0.5 pt-0.5">
              {([-1, 1] as const).map((direction) => {
                const impossible = direction === -1 ? index === 0 : index === options.length - 1;
                const label = `Mover alternativa ${index + 1} para ${direction === -1 ? "cima" : "baixo"}`;
                const Icon = direction === -1 ? ArrowUpIcon : ArrowDownIcon;
                return (
                  <Tooltip key={direction}>
                    <TooltipTrigger asChild>
                      <span className={impossible ? "invisible inline-flex" : "inline-flex"}>
                        <Button
                          aria-hidden={impossible || undefined}
                          aria-label={label}
                          size="icon-sm"
                          tabIndex={impossible ? -1 : undefined}
                          type="button"
                          variant="ghost"
                          disabled={readOnly || impossible}
                          onClick={() => {
                            const next = [...options];
                            [next[index], next[index + direction]] = [
                              next[index + direction]!,
                              next[index]!,
                            ];
                            onChange(next);
                          }}
                        >
                          <Icon />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{label}</TooltipContent>
                  </Tooltip>
                );
              })}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      size="icon-sm"
                      variant="ghost"
                      type="button"
                      disabled={readOnly || options.length <= 2}
                      aria-label={`Remover alternativa ${index + 1}`}
                      onClick={() => setPendingRemoval(option.id)}
                    >
                      <Trash2Icon />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Remover alternativa {index + 1}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        );
      })}
      {touched && (!hasValidOptionCount || hasEmptyOption || !hasSingleCorrectOption) && (
        <p className="text-xs text-destructive" role="alert">
          Preencha de duas a seis alternativas e marque uma única resposta correta.
        </p>
      )}

      <ConfirmationDialog
        actionLabel="Remover alternativa"
        destructive
        description="Esta alternativa será removida da questão."
        disabled={readOnly || options.length <= 2}
        onConfirm={() => {
          if (readOnly || options.length <= 2 || !optionToRemove) return;
          onChange(options.filter(({ id }) => id !== optionToRemove.id));
          setPendingRemoval(null);
        }}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
        open={Boolean(optionToRemove)}
        title="Remover alternativa?"
      />
    </fieldset>
  );
};
