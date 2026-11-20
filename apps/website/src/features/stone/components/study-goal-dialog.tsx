import { STUDY_GOAL_MAX, STUDY_GOAL_MIN, type StudyGoal } from "@lazuli/shared";
import { useState } from "react";
import { toast } from "sonner";

import { NumberStepper } from "@/components/number-stepper.tsx";
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
import { Label } from "@/components/ui/label.tsx";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group.tsx";
import { ViewSelector } from "@/components/view-selector.tsx";
import { getApiErrorMessage } from "@/lib/api-client.ts";
import { useSaveStudyGoal } from "../api/stone-queries.ts";
import { goalUnit, weekdays } from "./stone-parts.tsx";

const suggestions = [
  { id: "light", title: "Leve", value: 1, why: "Mantém o ritmo sem pesar." },
  { id: "medium", title: "Média", value: 2, why: "Revisar o que vence e avançar um pouco." },
  { id: "intense", title: "Intensa", value: 3, why: "Para semanas de prova." },
];

const clamp = (value: number) =>
  Math.min(STUDY_GOAL_MAX, Math.max(STUDY_GOAL_MIN, Math.round(value) || STUDY_GOAL_MIN));

/** The goal's fields: what counts, how many practices a day and the study days. */
export const StudyGoalFields = ({
  goal,
  onChange,
}: {
  goal: StudyGoal;
  onChange: (goal: StudyGoal) => void;
}) => {
  const [custom, setCustom] = useState(
    () => !suggestions.some(({ value }) => value === goal.practices),
  );
  // The custom number lives in its own card, so choosing it never adds a field to the dialog.
  const [customValue, setCustomValue] = useState(() => (custom ? goal.practices : 4));
  const preset = custom
    ? "custom"
    : (suggestions.find(({ value }) => value === goal.practices)?.id ?? "custom");
  const setCustomPractices = (value: number) => {
    const practices = clamp(value);
    setCustom(true);
    setCustomValue(practices);
    onChange({ ...goal, practices });
  };
  return (
    <div className="grid gap-5 text-sm">
      <div className="grid gap-2">
        <Label asChild>
          <p>O que conta</p>
        </Label>
        <ViewSelector
          fullWidth
          label="O que conta"
          onChange={(value) => onChange({ ...goal, counts: value as StudyGoal["counts"] })}
          options={[
            { value: "both", label: "Ambos" },
            { value: "flashcards", label: "Flashcards" },
            { value: "quizzes", label: "Quizzes" },
          ]}
          value={goal.counts}
        />
      </div>
      <div className="grid gap-2">
        <Label asChild>
          <p>Quanto por dia</p>
        </Label>
        <RadioGroup
          className="grid gap-2"
          onValueChange={(id) => {
            const picked = suggestions.find((option) => option.id === id);
            setCustom(!picked);
            onChange({ ...goal, practices: picked ? picked.value : customValue });
          }}
          value={preset}
        >
          {suggestions.map((option) => (
            <RadioCard
              description={option.why}
              key={option.id}
              title={`${option.title} · ${option.value} ${goalUnit(goal, option.value)}`}
              value={option.id}
            />
          ))}
          <div className="relative">
            <RadioCard
              className="pr-36"
              description={`${goalUnit(goal, customValue).replace(/^./, (c) => c.toUpperCase())} por dia, de ${STUDY_GOAL_MIN} a ${STUDY_GOAL_MAX}.`}
              title="Personalizada"
              value="custom"
            />
            {/* Beside the card, not inside its label: the stepper chooses "Personalizada" too. */}
            <NumberStepper
              active={custom}
              className="absolute top-1/2 right-3 -translate-y-1/2"
              decreaseLabel="Menos uma prática por dia"
              increaseLabel="Mais uma prática por dia"
              label="Práticas por dia, personalizada"
              max={STUDY_GOAL_MAX}
              min={STUDY_GOAL_MIN}
              onChange={setCustomPractices}
              onFocus={() => !custom && setCustomPractices(customValue)}
              value={customValue}
            />
          </div>
        </RadioGroup>
      </div>
      <div className="grid gap-2">
        <Label asChild>
          <p>Dias de estudo</p>
        </Label>
        <div className="grid grid-cols-7 gap-1.5">
          {weekdays.map((day, index) => (
            <Button
              aria-pressed={goal.days[index]}
              className="px-0"
              // At least one study day: the last one cannot be turned off.
              disabled={goal.days[index] && goal.days.filter(Boolean).length === 1}
              key={day}
              onClick={() =>
                onChange({
                  ...goal,
                  days: goal.days.map((value, at) => (at === index ? !value : value)),
                })
              }
              size="sm"
              type="button"
              variant={goal.days[index] ? "default" : "outline"}
            >
              {day}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Os dias de folga não contam contra a sua semana.
        </p>
      </div>
      <p className="rounded-[var(--radius)] bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
        Uma prática conta ao terminar ou depois de 20 respostas, o que vier primeiro. Um dia sem
        nada para praticar conta como cumprido.
      </p>
    </div>
  );
};

export const StudyGoalDialog = ({
  goal,
  onOpenChange,
  open,
}: {
  goal: StudyGoal;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const [draft, setDraft] = useState(goal);
  const save = useSaveStudyGoal();
  // Every opening starts from the saved goal (and a refetch while open keeps the draft).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(goal);
  }
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar meta diária</DialogTitle>
          <DialogDescription>
            O que conta como um dia estudado para a sua pedra. Vale de hoje em diante.
          </DialogDescription>
        </DialogHeader>
        <StudyGoalFields goal={draft} onChange={setDraft} />
        <DialogFooter>
          <DialogCancelButton disabled={save.isPending} onClick={() => onOpenChange(false)}>
            Cancelar
          </DialogCancelButton>
          <Button
            onClick={() =>
              save.mutate(draft, {
                onSuccess: () => {
                  toast.success("Meta salva.");
                  onOpenChange(false);
                },
                onError: (error) =>
                  toast.error(getApiErrorMessage(error, "Não foi possível salvar a meta.")),
              })
            }
            pending={save.isPending}
          >
            Salvar meta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
