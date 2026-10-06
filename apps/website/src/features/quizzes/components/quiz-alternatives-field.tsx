import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  CircleIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import { cn } from "@/lib/utils.ts";

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
  const duplicateOptionIds = useMemo(() => getDuplicateQuizOptionIds(options), [options]);
  const hasValidOptionCount = options.length >= 2 && options.length <= 6;
  const hasEmptyOption = options.some(({ text }) => !text.trim());
  const hasSingleCorrectOption = options.filter(({ isCorrect }) => isCorrect).length === 1;

  return (
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
                    onClick={() =>
                      onChange(
                        options.map((item) => ({
                          ...item,
                          isCorrect: item.id === option.id,
                        })),
                      )
                    }
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
                  const next = [...options];
                  [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                  onChange(next);
                }}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <ArrowUpIcon />
              </Button>
              <Button
                aria-label={`Mover alternativa ${index + 1} para baixo`}
                disabled={readOnly || index === options.length - 1}
                onClick={() => {
                  const next = [...options];
                  [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
                  onChange(next);
                }}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <ArrowDownIcon />
              </Button>
              <Button
                aria-label={`Remover alternativa ${index + 1}`}
                disabled={readOnly || options.length <= 2}
                onClick={() => onChange(options.filter(({ id }) => id !== option.id))}
                size="icon-sm"
                type="button"
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
          onClick={() =>
            onChange([...options, { id: crypto.randomUUID(), text: "", isCorrect: false }])
          }
          type="button"
          variant="outline"
        >
          <PlusIcon /> Adicionar alternativa
        </Button>
      )}
    </fieldset>
  );
};
