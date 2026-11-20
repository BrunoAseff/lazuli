import {
  STONE_LEVELS,
  STONE_SHINE_DAYS,
  nextStoneLevel,
  stoneLevelByNumber,
  type StoneDay,
  type StoneResponse,
} from "@lazuli/shared";
import { motion, useReducedMotion } from "motion/react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";

import { Facet } from "@/components/brand-mark.tsx";
import { CutGem } from "@/components/brand/cut-gem.tsx";
import { motionTokens } from "@/components/arc/motion-tokens.ts";
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
  levelTitle,
  MasteryLine,
  StoneGem,
} from "../components/stone-parts.tsx";
import { StudyGoalDialog } from "../components/study-goal-dialog.tsx";

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
const weekdayOf = (date: string) => (dayDate(date).getUTCDay() + 6) % 7;

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
      className={className}
      initial={reduced ? false : { opacity: 0, y: 10 }}
      transition={{ ...motionTokens.spring.smooth, delay: index * 0.06 }}
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

/** The five cuts on one line, filled in gold up to where the person is. */
const LevelTrack = ({ stone }: { stone: StoneResponse }) => {
  const current = stoneLevelByNumber(stone.level);
  const next = nextStoneLevel(stone.level);
  const partial = next
    ? Math.min(1, Math.max(0, (stone.mastered - current.from) / (next.from - current.from)))
    : 0;
  const filled = (stone.level - 1 + partial) / (STONE_LEVELS.length - 1);
  return (
    <div className="relative">
      {/* The line runs between the first and the last stone, behind them. */}
      <div className="absolute top-[18px] right-[10%] left-[10%] h-0.5 rounded-full bg-muted">
        <motion.div
          animate={{ scaleX: filled }}
          className="h-full origin-left rounded-full bg-[var(--gold)]"
          initial={{ scaleX: 0 }}
          transition={{ ...motionTokens.spring.smooth, delay: 0.25 }}
        />
      </div>
      <ol className="relative grid grid-cols-5">
        {STONE_LEVELS.map((item) => {
          const reachedAt = stone.levels.find(({ level }) => level === item.level)?.reachedAt;
          const reached = item.level <= stone.level;
          const here = item.level === stone.level;
          return (
            <li className="grid justify-items-center" key={item.level}>
              <Tip
                detail={
                  reached && reachedAt
                    ? `alcançado em ${shortDate.format(new Date(reachedAt))}`
                    : `com ${item.from} dominados · faltam ${item.from - stone.mastered}`
                }
                title={`Nível ${item.level} · ${item.name}`}
              >
                <button
                  aria-current={here ? "step" : undefined}
                  className="group grid justify-items-center gap-1.5 rounded-[var(--radius)] px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  type="button"
                >
                  <span
                    className={cn(
                      "rounded-full bg-card px-1 transition-transform duration-200 group-hover:-translate-y-0.5",
                      !reached && "opacity-45",
                    )}
                  >
                    <CutGem cut={item.cut} size={36} />
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      here ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {item.name}
                  </span>
                </button>
              </Tip>
            </li>
          );
        })}
      </ol>
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
    <section aria-labelledby="stone-level-title" className="surface-panel grid h-full gap-6 p-6">
      <div className="flex items-center gap-6">
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          initial={reduced ? false : { opacity: 0, scale: 0.9 }}
          transition={motionTokens.spring.smooth}
        >
          <StoneGem dull={stone.dull} level={stone.level} size={112} />
        </motion.div>
        <div className="grid min-w-0 flex-1 gap-4">
          <div>
            <h2 className="font-heading text-2xl leading-snug" id="stone-level-title">
              {levelTitle(stone.level)}
            </h2>
            <p className="mt-1 max-w-md text-[0.8125rem] text-muted-foreground">
              {next
                ? "O corte vem do que você domina e não volta atrás. O brilho vem da sua semana."
                : "O último corte. O contador segue, e o brilho continua pedindo a sua semana."}
            </p>
          </div>
          {next ? (
            <MasteryLine level={stone.level} mastered={stone.mastered} />
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
      {short && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] bg-muted/60 px-4 py-3">
          <p className="text-[0.8125rem] text-muted-foreground">
            {stone.notMastered
              ? `Você tem ${stone.notMastered} ${stone.notMastered === 1 ? "item ainda não dominado" : "itens ainda não dominados"}. Para chegar a ${next.name}, crie mais materiais.`
              : `Tudo o que você tem já está dominado. Para chegar a ${next.name}, crie mais materiais.`}
          </p>
          <Button asChild size="sm" variant="outline">
            <Link to="/documents">Ir para projetos</Link>
          </Button>
        </div>
      )}
      <div className="border-t border-[var(--line-subtle)] pt-5">
        <LevelTrack stone={stone} />
      </div>
    </section>
  );
};

/* Goal ----------------------------------------------------------------------------------------- */

const shineHint = (stone: StoneResponse) => {
  if (stone.paused) return "A meta volta a contar quando você tiver flashcards ou questões.";
  if (!stone.dull) return "A pedra está com brilho total.";
  const scheduled = stone.week.filter(({ status }) =>
    ["met", "free", "missed"].includes(status),
  ).length;
  const missing = Math.max(1, Math.min(STONE_SHINE_DAYS, scheduled) - stone.studiedDays);
  return `Mais ${missing} ${missing === 1 ? "dia estudado devolve" : "dias estudados devolvem"} o brilho.`;
};

const GoalPanel = ({ onEdit, stone }: { onEdit: () => void; stone: StoneResponse }) => (
  <section aria-labelledby="stone-goal-title" className="surface-panel grid h-full gap-5 p-6">
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
    <div className="grid content-end gap-3">
      <p className="text-xs text-foreground">Últimos 7 dias</p>
      <ol className="grid grid-cols-7 gap-1.5">
        {stone.week.map((day, index) => {
          const tip = dayTip(day);
          const today = index === stone.week.length - 1;
          return (
            <li key={day.date}>
              <Tip detail={tip.detail} title={today ? "Hoje" : tip.title}>
                <button
                  className={cn(
                    "grid w-full justify-items-center gap-1.5 rounded-[var(--radius)] border border-transparent py-2 outline-none transition-colors hover:border-[var(--line-subtle)] focus-visible:ring-2 focus-visible:ring-ring/50",
                    today && "border-[var(--line-subtle)]",
                  )}
                  type="button"
                >
                  <span className="text-[0.6875rem] text-muted-foreground">
                    {initials[weekdayOf(day.date)]}
                  </span>
                  <DayMark day={day} size="0.75rem" />
                </button>
              </Tip>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">
        <span className="text-foreground">
          {stone.studiedDays} {stone.studiedDays === 1 ? "dia estudado" : "dias estudados"}
        </span>{" "}
        · {shineHint(stone)}
      </p>
    </div>
  </section>
);

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

/** Days in a row with the goal, days off and today (still open) neither count nor break. */
const streaks = (days: StoneDay[]) => {
  let best = 0;
  let run = 0;
  for (const day of days) {
    if (studied(day)) run += 1;
    else if (day.status === "missed") run = 0;
    best = Math.max(best, run);
  }
  return { best, current: run };
};

const History = ({ days }: { days: StoneDay[] }) => {
  const weeks: StoneDay[][] = [];
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));
  const counted = days.filter(({ status }) => ["met", "free", "missed"].includes(status));
  const { best, current } = streaks(days);
  const practices = days.reduce((sum, day) => sum + day.practices, 0);
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
  const stats = [
    { label: "Dias estudados", value: `${counted.filter(studied).length} de ${counted.length}` },
    { label: "Sequência atual", value: `${current} ${current === 1 ? "dia" : "dias"}` },
    { label: "Melhor sequência", value: `${best} ${best === 1 ? "dia" : "dias"}` },
    { label: "Práticas", value: String(practices) },
  ];
  return (
    <section aria-labelledby="stone-history-title" className="surface-panel p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-sm font-semibold" id="stone-history-title">
          Últimas 12 semanas
        </h2>
        <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
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
      <div className="mt-5 flex flex-wrap items-center gap-x-12 gap-y-6">
        {/* Room around the grid, so a day growing under the pointer never makes it scroll. */}
        <div className="-m-1.5 max-w-full overflow-x-auto p-1.5">
          <div className="flex w-max gap-1.5">
            <div className="grid grid-rows-[0.875rem_repeat(7,1.25rem)] gap-1 pr-1 text-[0.6875rem] text-muted-foreground">
              <span />
              {initials.map((initial, index) => (
                <span className="grid place-items-center" key={index}>
                  {initial}
                </span>
              ))}
            </div>
            {weeks.map((week, index) => {
              const month = monthLabels[index];
              return (
                <div
                  className="grid grid-rows-[0.875rem_repeat(7,1.25rem)] gap-1"
                  key={week[0]!.date}
                >
                  <span className="w-5 overflow-visible text-[0.6875rem] whitespace-nowrap text-muted-foreground">
                    {month}
                  </span>
                  {week.map((day) => {
                    const tip = dayTip(day);
                    return (
                      <Tip detail={tip.detail} key={day.date} title={tip.title}>
                        <button
                          aria-label={`${tip.title}: ${tip.detail}`}
                          className={cn(
                            "grid size-5 place-items-center rounded-[0.3125rem] outline-none transition-transform duration-150 hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring/50",
                            day.date === today && "ring-1 ring-primary/40",
                          )}
                          type="button"
                        >
                          <DayMark day={day} size="0.75rem" />
                        </button>
                      </Tip>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        <dl className="grid min-w-[16rem] flex-1 grid-cols-2 gap-x-8 gap-y-5">
          {stats.map((stat) => (
            <div className="border-l border-[var(--line-subtle)] pl-4" key={stat.label}>
              <dt className="text-xs text-muted-foreground">{stat.label}</dt>
              <dd className="mt-1 font-heading text-2xl leading-none tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};

/* Projects ------------------------------------------------------------------------------------- */

const Projects = ({ stone }: { stone: StoneResponse }) => (
  <section aria-labelledby="stone-projects-title" className="surface-panel p-6">
    <h2 className="text-sm font-semibold" id="stone-projects-title">
      Domínio por projeto
    </h2>
    {stone.projects.length ? (
      <ul className="mt-4 grid gap-x-10 gap-y-2 md:grid-cols-2">
        {stone.projects.map((project) => (
          <li key={project.projectId}>
            <Link
              className="group -mx-2 grid gap-2 rounded-[var(--radius)] px-2 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              to={`/documents/${project.projectId}`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                  <span className="truncate group-hover:underline group-hover:underline-offset-4">
                    {project.title}
                  </span>
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="size-3.5 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                  />
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {project.mastered} de {project.total} dominados
                </span>
              </span>
              <FillingProgress
                aria-label={`Domínio de ${project.title}`}
                className={goldBar}
                max={Math.max(1, project.total)}
                value={project.mastered}
              />
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
  const [editing, setEditing] = useState(false);
  return (
    <ContentPage maxWidth="6xl">
      <h1 className="page-title">Sua pedra</h1>
      {stone.isPending ? (
        <div aria-busy="true" className="mt-6 grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
          <Skeleton className="h-56" />
        </div>
      ) : stone.isError || !stone.data ? (
        <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
          Não foi possível carregar sua pedra.
          <Button onClick={() => void stone.refetch()} size="sm" variant="outline">
            Tentar de novo
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Reveal index={0}>
              <LevelPanel stone={stone.data} />
            </Reveal>
            <Reveal index={1}>
              <GoalPanel onEdit={() => setEditing(true)} stone={stone.data} />
            </Reveal>
          </div>
          <Reveal index={2}>
            <History days={stone.data.history} />
          </Reveal>
          <Reveal index={3}>
            <Projects stone={stone.data} />
          </Reveal>
          <StudyGoalDialog goal={stone.data.goal} onOpenChange={setEditing} open={editing} />
        </div>
      )}
    </ContentPage>
  );
};

export default StonePage;
