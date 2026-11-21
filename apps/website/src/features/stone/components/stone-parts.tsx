import type { ReactNode } from "react";
import {
  nextStoneLevel,
  stoneLevelByNumber,
  type StoneDay,
  type StoneResponse,
  type StudyGoal,
} from "@lazuli/shared";
import { useEffect, useState, type ComponentProps, type CSSProperties } from "react";

import { Facet } from "@/components/brand-mark.tsx";
import { CutGem } from "@/components/brand/cut-gem.tsx";
import { Progress } from "@/components/ui/progress.tsx";

/* The pieces "Sua pedra" shares between the home card, its own page and the session summaries. */

export const goldBar = "h-1.5 [&>[data-slot=progress-indicator]]:bg-[var(--gold)]";

export const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** A bar that fills from empty when it appears, so progress reads as movement. */
export const FillingProgress = ({ value = 0, ...props }: ComponentProps<typeof Progress>) => {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(value ?? 0));
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <Progress value={shown} {...props} />;
};

export const StoneGem = ({
  dull = 0,
  level,
  size,
}: {
  dull?: number;
  level: number;
  size: number;
}) => <CutGem cut={stoneLevelByNumber(level).cut} dull={dull} size={size} />;

export const levelTitle = (level: number) => {
  const item = stoneLevelByNumber(level);
  return `Nível ${item.level} · ${item.name}`;
};

/** "prática ou quiz", "práticas de flashcards"… for what the goal counts. */
export const goalUnit = (goal: Pick<StudyGoal, "counts">, value: number) => {
  const one = value === 1;
  if (goal.counts === "quizzes") return one ? "quiz" : "quizzes";
  if (goal.counts === "flashcards") return one ? "prática de flashcards" : "práticas de flashcards";
  return one ? "prática ou quiz" : "práticas ou quizzes";
};

export const goalText = (goal: StudyGoal) => `${goal.practices} ${goalUnit(goal, goal.practices)}`;

export const goalDaysText = (goal: StudyGoal) =>
  goal.days.every(Boolean)
    ? "todos os dias"
    : weekdays.filter((_, index) => goal.days[index]).join(", ");

/** The study days of the last seven: lit when the goal was kept. */
export const WeekFacets = ({ week }: { week: StoneDay[] }) => (
  <span aria-hidden="true" className="flex shrink-0 items-center gap-1">
    {week
      .filter(({ status, studyDay }) => studyDay && ["met", "free", "missed"].includes(status))
      .map((day) => (
        <Facet
          key={day.date}
          state={day.status === "missed" ? "idle" : "active"}
          style={{ "--facet-size": "0.4375rem" } as CSSProperties}
        />
      ))}
  </span>
);

export const keptText = (stone: StoneResponse) =>
  stone.plannedDays
    ? `${stone.keptDays} de ${stone.plannedDays} ${stone.plannedDays === 1 ? "dia de estudo" : "dias de estudo"} nos últimos 7`
    : "Nenhum dia de estudo nos últimos 7";

export const WeekLine = ({ stone }: { stone: StoneResponse }) => (
  <div className="flex items-center gap-2 text-xs text-foreground">
    <WeekFacets week={stone.week} />
    {keptText(stone)}
  </div>
);

/**
 * The mastered count on its way to the next level, in gold. `label` replaces the count on the left
 * (a session summary says what it added instead).
 */
export const MasteryLine = ({
  label,
  level,
  mastered,
}: {
  label?: ReactNode;
  level: number;
  mastered: number;
}) => {
  const current = stoneLevelByNumber(level);
  const next = nextStoneLevel(level);
  const from = Math.min(current.from, mastered);
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-xs">
        <span className="text-foreground">
          {label ?? (
            <>
              <span className="tabular-nums">{mastered}</span>{" "}
              {mastered === 1 ? "item dominado" : "itens dominados"}
            </>
          )}
        </span>
        <span className="whitespace-nowrap text-muted-foreground tabular-nums">
          {next
            ? `faltam ${Math.max(0, next.from - mastered)} para o nível ${next.level}`
            : "último nível"}
        </span>
      </div>
      <FillingProgress
        aria-label="Domínio até o próximo nível"
        className={goldBar}
        max={next ? next.from - from : 1}
        value={next ? mastered - from : 1}
      />
    </div>
  );
};

export const GoalLine = ({ stone }: { stone: StoneResponse }) => {
  const { goal, paused, today } = stone;
  const done = today.status === "met" || today.status === "free";
  const label = paused
    ? "pausada até você ter materiais"
    : today.status === "off"
      ? "folga hoje"
      : today.status === "free"
        ? "nada para hoje"
        : done
          ? "cumprida"
          : `${today.practices} de ${goalText(goal)}`;
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-xs">
        <span className="text-foreground">Meta de hoje</span>
        <span className="whitespace-nowrap text-muted-foreground tabular-nums">{label}</span>
      </div>
      <FillingProgress
        aria-label={`Meta de hoje: ${label}`}
        className="h-1.5"
        max={goal.practices}
        value={done ? goal.practices : Math.min(today.practices, goal.practices)}
      />
    </div>
  );
};
