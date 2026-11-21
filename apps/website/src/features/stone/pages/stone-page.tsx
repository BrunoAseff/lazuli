import {
  STONE_LEVELS,
  nextStoneLevel,
  stoneLevelByNumber,
  type StoneDay,
  type StoneResponse,
} from "@lazuli/shared";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";

import { Facet } from "@/components/brand-mark.tsx";
import { CutGem } from "@/components/brand/cut-gem.tsx";
import { ContentPage } from "@/components/content-page.tsx";
import { ArrowRightIcon, PencilIcon } from "@/components/icons.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import { cn } from "@/lib/utils.ts";
import { useStone } from "../api/stone-queries.ts";
import {
  FillingProgress,
  GoalLine,
  goalDaysText,
  goalText,
  goldBar,
  keptText,
  levelTitle,
  MasteryLine,
  StoneGem,
} from "../components/stone-parts.tsx";
import { StudyGoalDialog } from "../components/study-goal-dialog.tsx";
import { LoadError } from "@/components/empty-state.tsx";
import { spring } from "@/lib/motion.ts";

/*
 * "Sua pedra": the level and the way to the next one, the daily goal and this week, twelve weeks
 * of history and the mastery of each project. Every mark explains itself on hover or focus.
 */

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
const longDay = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  weekday: "long",
});
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
const dayDate = (date: string) => new Date(`${date}T12:00:00Z`);
const initials = ["S", "T", "Q", "Q", "S", "S", "D"];

const statusLabel: Record<StoneDay["status"], string> = {
  met: "meta cumprida",
  free: "nada para praticar, conta como estudado",
  missed: "sem a meta",
  off: "folga",
  open: "em aberto",
  none: "antes da sua conta",
};

const studied = (day: StoneDay) => day.status === "met" || day.status === "free";

const dayTip = (day: StoneDay) => {
  const title = longDay.format(dayDate(day.date)).replace(/^./, (c) => c.toUpperCase());
  const practices =
    day.practices && day.status !== "none"
      ? ` · ${day.practices} ${day.practices === 1 ? "prática" : "práticas"}`
      : "";
  return { title, detail: `${statusLabel[day.status]}${practices}` };
};

/** Fades each block in, one after the other, when the page opens. */
const Reveal = ({
  children,
  className,
  index,
}: {
  children: ReactNode;
  className?: string;
  index: number;
}) => {
  const reduced = useReducedMotion();
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn("min-w-0", className)}
      initial={reduced ? false : { opacity: 0, y: 10 }}
      transition={{ ...spring.smooth, delay: index * 0.06 }}
    >
      {children}
    </motion.div>
  );
};

const Tip = ({
  children,
  detail,
  title,
}: {
  children: ReactNode;
  detail: string;
  title: string;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side="top" sideOffset={6}>
      <span className="grid gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">{detail}</span>
      </span>
    </TooltipContent>
  </Tooltip>
);

/* Level ---------------------------------------------------------------------------------------- */

const levelNote = (stone: StoneResponse, level: number) => {
  const item = stoneLevelByNumber(level);
  const reachedAt = stone.levels.find((entry) => entry.level === level)?.reachedAt;
  if (level < stone.level)
    return reachedAt ? `alcançado em ${shortDate.format(new Date(reachedAt))}` : "alcançado";
  return `a partir de ${item.from} dominados`;
};

/**
 * The five cuts on one line, filled in gold up to where the person is. Pointing at a level lights
 * its stone, marks the way to it on the line and says, below, what it takes or when it came.
 */
const LevelTrack = ({ stone }: { stone: StoneResponse }) => {
  const reduced = useReducedMotion();
  const [pointed, setPointed] = useState<number | null>(null);
  const current = stoneLevelByNumber(stone.level);
  const next = nextStoneLevel(stone.level);
  const partial = next
    ? Math.min(1, Math.max(0, (stone.mastered - current.from) / (next.from - current.from)))
    : 0;
  const steps = STONE_LEVELS.length - 1;
  const filled = (stone.level - 1 + partial) / steps;
  const shown = pointed ?? stone.level;
  const ahead = pointed && pointed > stone.level ? (pointed - 1) / steps : null;
  const lineMotion = reduced ? { duration: 0 } : spring.smooth;
  return (
    <div className="relative" onMouseLeave={() => setPointed(null)}>
      <div className="relative">
        {/* The line runs between the first and the last stone, behind them. */}
        <div className="absolute top-[18px] right-[10%] left-[10%] h-0.5 rounded-full bg-muted">
          <motion.div
            animate={{
              width: ahead ? `${ahead * 100}%` : `${filled * 100}%`,
              opacity: ahead ? 1 : 0,
            }}
            className="absolute inset-y-0 left-0 rounded-full bg-primary/50"
            initial={false}
            transition={lineMotion}
          />
          <motion.div
            animate={{ scaleX: filled }}
            className="absolute inset-0 origin-left rounded-full bg-[var(--gold)]"
            initial={reduced ? false : { scaleX: 0 }}
            transition={{ ...lineMotion, delay: reduced ? 0 : 0.25 }}
          />
        </div>
        <ol className="relative grid grid-cols-5">
          {STONE_LEVELS.map((item) => {
            const reached = item.level <= stone.level;
            const lit = reached || item.level === pointed;
            return (
              <li className="grid justify-items-center" key={item.level}>
                <button
                  aria-current={item.level === stone.level ? "step" : undefined}
                  aria-label={`Nível ${item.level} · ${item.name}: ${levelNote(stone, item.level)}`}
                  className="grid justify-items-center gap-1.5 rounded-[var(--radius)] px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  onBlur={() => setPointed(null)}
                  onFocus={() => setPointed(item.level)}
                  onMouseEnter={() => setPointed(item.level)}
                  type="button"
                >
                  {/* The white behind stays solid so the line never shows through a faded stone. */}
                  <span className="rounded-full bg-card px-1">
                    <span
                      className={cn("block transition-opacity duration-200", !lit && "opacity-45")}
                    >
                      <CutGem cut={item.cut} size={36} />
                    </span>
                  </span>
                  {/* On a phone only the level in focus is named; the caption says the rest. */}
                  <span
                    className={cn(
                      "text-xs whitespace-nowrap transition-colors",
                      item.level === shown
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground max-sm:sr-only",
                    )}
                  >
                    {item.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {/* Over the panel's own padding, so an empty note at rest takes no room. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-full mt-3 h-4 overflow-hidden text-center text-xs"
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="text-muted-foreground"
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
            key={shown}
            transition={spring.snap}
          >
            {/* Only another level gets a note: the panel already says where the person is. */}
            {shown !== stone.level && (
              <>
                <span className="text-foreground">{stoneLevelByNumber(shown).name}</span> ·{" "}
                {levelNote(stone, shown)}
              </>
            )}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
};

const LevelPanel = ({ stone }: { stone: StoneResponse }) => {
  const reduced = useReducedMotion();
  const next = nextStoneLevel(stone.level);
  // Fewer items left to master than the next level asks: say so, and where more come from.
  const short = next && stone.notMastered < next.from - stone.mastered;
  const polishedAt = stone.levels.find(({ level }) => level === 5)?.reachedAt;
  return (
    <section
      aria-labelledby="stone-level-title"
      className="surface-panel grid items-center gap-x-12 gap-y-8 px-6 pt-6 pb-8 sm:p-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,6fr)]"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className="shrink-0"
          initial={reduced ? false : { opacity: 0, scale: 0.9 }}
          transition={spring.smooth}
        >
          <StoneGem dull={stone.dull} level={stone.level} size={112} />
        </motion.div>
        <div className="grid min-w-0 flex-1 gap-4">
          <div>
            <h2 className="font-heading text-2xl leading-snug" id="stone-level-title">
              {levelTitle(stone.level)}
            </h2>
            <p className="mt-1 text-[0.8125rem] text-muted-foreground">
              {next
                ? "O corte vem do que você domina e não volta atrás."
                : "O último corte. O contador segue."}
            </p>
          </div>
          {next ? (
            <div className="grid gap-3">
              <MasteryLine level={stone.level} mastered={stone.mastered} />
              {/* Not enough left to master for the next level: say where more comes from. */}
              {short && (
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <p className="text-xs text-muted-foreground">
                    Crie mais materiais para chegar a {next.name}.
                  </p>
                  <Button asChild size="xs" variant="outline">
                    <Link to="/documents">Ir para projetos</Link>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-1.5">
              <div className="flex justify-between gap-3 text-xs">
                <span>
                  <span className="tabular-nums">{stone.mastered}</span> itens dominados
                </span>
                {polishedAt && (
                  <span className="text-muted-foreground">
                    polida desde {shortDate.format(new Date(polishedAt))}
                  </span>
                )}
              </div>
              <FillingProgress aria-label="Domínio" className={goldBar} max={1} value={1} />
            </div>
          )}
        </div>
      </div>
      <LevelTrack stone={stone} />
    </section>
  );
};

/* Goal ----------------------------------------------------------------------------------------- */

/**
 * The shine as a scale of the person's own stone, from black and white (no study day kept) to
 * full colour (every study day kept): one stone per possible count, the ones reached shown whole
 * and the rest faded, like the level track.
 */
const ShineMeter = ({ stone }: { stone: StoneResponse }) => {
  const steps = stone.plannedDays;
  return (
    <div className="grid gap-2.5">
      <p className="text-xs text-foreground">Brilho da pedra</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {steps > 0 && (
          <ol className="flex items-center gap-1">
            {Array.from({ length: steps + 1 }, (_, kept) => {
              const here = kept === stone.keptDays;
              return (
                <li key={kept}>
                  <Tip
                    detail={here ? "como sua pedra está agora" : "como ela fica"}
                    title={`${kept} de ${steps} ${steps === 1 ? "dia de estudo" : "dias de estudo"}`}
                  >
                    <button
                      aria-current={here ? "step" : undefined}
                      aria-label={`Brilho com ${kept} de ${steps} dias de estudo${here ? ", agora" : ""}`}
                      className={cn(
                        "grid place-items-center rounded-[var(--radius)] p-0.5 outline-none transition-opacity duration-200 focus-visible:ring-2 focus-visible:ring-ring/50",
                        kept > stone.keptDays && "opacity-40 hover:opacity-100",
                      )}
                      type="button"
                    >
                      <StoneGem dull={1 - kept / steps} level={stone.level} size={24} />
                    </button>
                  </Tip>
                </li>
              );
            })}
          </ol>
        )}
        <p className="text-xs text-muted-foreground">
          {stone.paused
            ? "Volta a contar quando você tiver flashcards ou questões."
            : `${keptText(stone)}.`}
        </p>
      </div>
    </div>
  );
};

/* History -------------------------------------------------------------------------------------- */

const DayMark = ({ day, size }: { day: StoneDay; size: string }) => {
  if (day.status === "none") return <span className="size-1 rounded-full bg-muted-foreground/20" />;
  if (day.status === "off")
    return (
      <span
        className="rounded-full border border-dashed border-muted-foreground/45"
        style={{ height: `calc(${size} * 0.8)`, width: `calc(${size} * 0.8)` }}
      />
    );
  return (
    <Facet
      state={studied(day) ? "active" : "idle"}
      style={{ "--facet-size": size } as CSSProperties}
    />
  );
};

/** Twelve weeks of the goal, a column per week, Monday on top; each day explains itself. */
const History = ({ days }: { days: StoneDay[] }) => {
  const weeks: StoneDay[][] = [];
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));
  const today = days.at(-1)?.date;
  // A month is named on its first week, when there is room for the name before the next one.
  const monthLabels: string[] = [];
  let lastLabel = -3;
  weeks.forEach((week, index) => {
    const month = monthName.format(dayDate(week.at(-1)!.date));
    const previous = index ? monthName.format(dayDate(weeks[index - 1]!.at(-1)!.date)) : "";
    const named = month !== previous && index - lastLabel >= 2 && index < weeks.length - 1;
    monthLabels.push(named ? month : "");
    if (named) lastLabel = index;
  });
  return (
    <div className="grid min-w-0 content-start gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1.5 xl:flex-nowrap">
        <h3 className="text-xs text-foreground">Últimas 12 semanas</h3>
        <span className="flex items-center gap-x-3 text-xs whitespace-nowrap text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Facet state="active" style={{ "--facet-size": "0.5rem" } as CSSProperties} />
            Dia estudado
          </span>
          <span className="flex items-center gap-1.5">
            <Facet state="idle" style={{ "--facet-size": "0.5rem" } as CSSProperties} />
            Sem a meta
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full border border-dashed border-muted-foreground/50" />
            Folga
          </span>
        </span>
      </div>

      {/* Room around the grid, so a day growing under the pointer never makes it scroll. */}
      <div className="-m-1.5 max-w-full min-w-0 overflow-x-auto p-1.5 xl:max-w-none xl:min-w-max xl:overflow-visible">
        <div className="flex w-max min-w-full justify-between gap-1.5">
          <div className="grid grid-rows-[0.875rem_repeat(7,1rem)] gap-1 pr-1 text-[0.6875rem] text-muted-foreground">
            <span />
            {initials.map((initial, index) => (
              <span className="grid place-items-center" key={index}>
                {initial}
              </span>
            ))}
          </div>
          {weeks.map((week, index) => (
            <div className="grid grid-rows-[0.875rem_repeat(7,1rem)] gap-1" key={week[0]!.date}>
              <span className="w-4 overflow-visible text-[0.6875rem] whitespace-nowrap text-muted-foreground">
                {monthLabels[index]}
              </span>
              {week.map((day) => {
                const tip = dayTip(day);
                return (
                  <Tip detail={tip.detail} key={day.date} title={tip.title}>
                    <button
                      aria-label={`${tip.title}: ${tip.detail}`}
                      className={cn(
                        "grid size-4 place-items-center rounded-[0.25rem] outline-none transition-transform duration-150 hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring/50",
                        day.date === today && "ring-1 ring-primary/40",
                      )}
                      type="button"
                    >
                      <DayMark day={day} size="0.625rem" />
                    </button>
                  </Tip>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * The goal in one panel: what it is, today against it and the shine on one side, and the twelve
 * weeks it was kept on the other. The weeks are the goal's own record, so they live here.
 */
const GoalPanel = ({ onEdit, stone }: { onEdit: () => void; stone: StoneResponse }) => (
  <section
    aria-labelledby="stone-goal-title"
    className="surface-panel grid gap-x-14 gap-y-8 p-6 sm:p-8 xl:grid-cols-[minmax(0,1fr)_auto]"
  >
    <div className="flex min-w-0 flex-col justify-between gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold" id="stone-goal-title">
            Meta diária
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
            {goalText(stone.goal)} · {goalDaysText(stone.goal)}
          </p>
        </div>
        <Button className="shrink-0" onClick={onEdit} size="sm" variant="outline">
          <PencilIcon aria-hidden="true" /> Editar meta
        </Button>
      </div>
      <GoalLine stone={stone} />
      <ShineMeter stone={stone} />
    </div>
    <History days={stone.history} />
  </section>
);

/* Projects ------------------------------------------------------------------------------------- */

const Projects = ({ stone }: { stone: StoneResponse }) => (
  <section aria-labelledby="stone-projects-title" className="surface-panel p-6 sm:p-8">
    <h2 className="text-sm font-semibold" id="stone-projects-title">
      Domínio por projeto
    </h2>
    {stone.projects.length ? (
      <ul className="mt-3 grid">
        {stone.projects.map((project) => (
          <li key={project.projectId}>
            <Link
              className="group grid items-center gap-x-8 gap-y-2 rounded-[var(--radius)] py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_9rem]"
              to={`/documents/${project.projectId}`}
            >
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                <span className="truncate group-hover:underline group-hover:underline-offset-4">
                  {project.title}
                </span>
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-3.5 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                />
              </span>
              <FillingProgress
                aria-label={`Domínio de ${project.title}`}
                className={goldBar}
                max={Math.max(1, project.total)}
                value={project.mastered}
              />
              <span className="text-xs text-muted-foreground tabular-nums md:text-right">
                {project.mastered} de {project.total} dominados
              </span>
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-2 text-sm text-muted-foreground">
        Os projetos aparecem aqui quando tiverem flashcards ou questões.
      </p>
    )}
  </section>
);

/* Page ----------------------------------------------------------------------------------------- */

export const StonePage = () => {
  const stone = useStone();
  // "?meta=editar" (from the first steps) opens the goal editor on arrival.
  const [params, setParams] = useSearchParams();
  const [editing, setEditingState] = useState(params.get("meta") === "editar");
  const setEditing = (open: boolean) => {
    setEditingState(open);
    if (!open && params.has("meta")) setParams({}, { replace: true });
  };
  return (
    <ContentPage maxWidth="6xl">
      <h1 className="page-title">Sua pedra</h1>
      {stone.isPending ? (
        <div aria-busy="true" className="mt-6 grid gap-4">
          <Skeleton className="h-44" />
          <Skeleton className="h-72" />
        </div>
      ) : stone.isError || !stone.data ? (
        <LoadError
          className="mt-6"
          onRetry={() => void stone.refetch()}
          title="Não foi possível carregar sua pedra"
        />
      ) : (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4">
          <Reveal index={0}>
            <LevelPanel stone={stone.data} />
          </Reveal>
          <Reveal index={1}>
            <GoalPanel onEdit={() => setEditing(true)} stone={stone.data} />
          </Reveal>
          <Reveal index={2}>
            <Projects stone={stone.data} />
          </Reveal>
          <StudyGoalDialog goal={stone.data.goal} onOpenChange={setEditing} open={editing} />
        </div>
      )}
    </ContentPage>
  );
};

export default StonePage;
