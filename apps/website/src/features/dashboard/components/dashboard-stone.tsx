import type { DashboardResponse } from "@lazuli/shared";
import type { CSSProperties } from "react";
import { useState } from "react";

import { Facet } from "@/components/brand-mark.tsx";
import { CutGem, gemStage } from "@/components/brand/cut-gem.tsx";
import { HelpCircleIcon } from "@/components/icons.tsx";
import { Button } from "@/components/ui/button.tsx";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { cn } from "@/lib/utils.ts";

type StudyGoal = DashboardResponse["studyGoal"];

/** How cut the stone is for each count of goal days in the last seven (0 → 7). */
const cutByDays = [0, 0.25, 0.4, 0.5, 0.65, 0.75, 0.9, 1];

const stages = [
  { cut: 0, days: "0 dias" },
  { cut: 0.25, days: "1–2 dias" },
  { cut: 0.5, days: "3–4 dias" },
  { cut: 0.75, days: "5–6 dias" },
  { cut: 1, days: "7 dias" },
];

const dayName = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  weekday: "long",
});
const dayLabel = (date: string, isToday: boolean) =>
  isToday
    ? "Hoje"
    : dayName.format(new Date(`${date}T12:00:00Z`)).replace(/^./, (c) => c.toUpperCase());
const small = { "--facet-size": "0.5rem" } as CSSProperties;

/**
 * The person's stone follows their rhythm: it is cut by the days they met the study goal in the
 * last seven, and loses its cut as those days leave the window. The same for any library size.
 */
export const DashboardStone = ({ bare = false, goal }: { bare?: boolean; goal: StudyGoal }) => {
  const metDays = goal.days.filter(({ met }) => met).length;
  const cut = cutByDays[metDays] ?? 0;
  const today = goal.days.at(-1);
  const todayActions = Math.min(today?.actions ?? 0, goal.target);
  const todayLabel = today?.met ? "cumprida" : `${todayActions} de ${goal.target}`;
  return (
    <section
      aria-labelledby="dashboard-stone-title"
      // `bare` drops the card when the stone sits inside a larger surface.
      className={cn("flex items-center gap-5", !bare && "surface-panel p-6")}
    >
      <CutGem cut={cut} size={76} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-center gap-1">
            <h2 id="dashboard-stone-title" className="text-sm font-semibold">
              Sua pedra
            </h2>
            <StoneGuide currentCut={cut} target={goal.target} />
          </div>
          <span className="text-xs text-muted-foreground">{gemStage(cut)}</span>
        </div>
        <StudyDays days={goal.days} metDays={metDays} target={goal.target} />
        <div className="mt-5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Meta de hoje</span>
            <span className="tabular-nums">{todayLabel}</span>
          </div>
          <Progress
            aria-label={`Meta de hoje: ${todayLabel}`}
            className="mt-1.5 h-1.5"
            max={goal.target}
            value={today?.met ? goal.target : todayActions}
          />
        </div>
      </div>
    </section>
  );
};

/**
 * How the stone works, on demand: the daily goal and every stage with the days it needs.
 * Opens on hover and focus, and on tap for touch screens.
 */
const StoneGuide = ({ currentCut, target }: { currentCut: number; target: number }) => {
  const [open, setOpen] = useState(false);
  return (
    <HoverCard onOpenChange={setOpen} open={open} openDelay={150}>
      <HoverCardTrigger asChild>
        <Button
          aria-label="Como a pedra funciona"
          className="text-muted-foreground"
          onClick={() => setOpen(!open)}
          size="icon-xs"
          variant="ghost"
        >
          <HelpCircleIcon />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80">
        <p className="font-medium">Como a pedra é lapidada</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Um dia conta como estudado com {target} revisões ou questões, ou quando você zera as
          revisões pendentes. A pedra mostra quantos dos últimos 7 dias foram estudados.
        </p>
        <ol className="mt-3 grid gap-0.5">
          {stages.map((stage) => {
            const here = gemStage(currentCut) === gemStage(stage.cut);
            return (
              <li
                key={stage.cut}
                aria-current={here ? "step" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius)] px-2 py-1.5",
                  here && "bg-muted",
                )}
              >
                <CutGem cut={stage.cut} size={28} />
                <span className={cn("flex-1", here && "font-medium")}>{gemStage(stage.cut)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{stage.days}</span>
              </li>
            );
          })}
        </ol>
      </HoverCardContent>
    </HoverCard>
  );
};

/**
 * The count of studied days; the week behind it opens on hover, focus or tap, one day per row
 * with its status, so "studied" is never ambiguous.
 */
const StudyDays = ({
  days,
  metDays,
  target,
}: {
  days: StudyGoal["days"];
  metDays: number;
  target: number;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <HoverCard onOpenChange={setOpen} open={open} openDelay={150}>
      <HoverCardTrigger asChild>
        <button
          className="mt-3 block text-left text-sm font-medium underline decoration-dotted decoration-muted-foreground/60 underline-offset-4 outline-none hover:decoration-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50"
          onClick={() => setOpen(!open)}
          type="button"
        >
          {metDays} {metDays === 1 ? "dia estudado" : "dias estudados"} nos últimos 7
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-72">
        <p className="font-medium">Últimos 7 dias</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Um dia conta quando você faz {target} revisões ou questões, ou zera as revisões pendentes.
        </p>
        <ol className="mt-3 grid gap-0.5">
          {[...days].reverse().map((day, index) => (
            <li key={day.date} className="flex items-center gap-3 px-2 py-1.5">
              <Facet state={day.met ? "active" : "idle"} style={small} />
              <span className="flex-1 text-sm">{dayLabel(day.date, index === 0)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {day.met
                  ? "Estudado"
                  : day.actions
                    ? `${Math.min(day.actions, target)} de ${target}`
                    : "Sem estudo"}
              </span>
            </li>
          ))}
        </ol>
      </HoverCardContent>
    </HoverCard>
  );
};
