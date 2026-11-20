import { STONE_LEVELS, nextStoneLevel, type StoneDay, type StoneResponse } from "@lazuli/shared";
import { useState, type CSSProperties } from "react";
import { Link } from "react-router";

import { Facet } from "@/components/brand-mark.tsx";
import { CutGem } from "@/components/brand/cut-gem.tsx";
import { ContentPage } from "@/components/content-page.tsx";
import { PencilIcon } from "@/components/icons.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { useStone } from "../api/stone-queries.ts";
import {
  GoalLine,
  goalDaysText,
  goalText,
  goldBar,
  levelTitle,
  MasteryLine,
  StoneGem,
  WeekLine,
} from "../components/stone-parts.tsx";
import { StudyGoalDialog } from "../components/study-goal-dialog.tsx";

const reachedDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
const dayTitle = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  weekday: "long",
});

const statusLabel: Record<StoneDay["status"], string> = {
  met: "Dia estudado",
  free: "Nada para praticar",
  missed: "Sem a meta",
  off: "Folga",
  open: "Hoje, em aberto",
  none: "Antes da sua conta",
};

const LevelPanel = ({ stone }: { stone: StoneResponse }) => {
  const next = nextStoneLevel(stone.level);
  // Fewer items left to master than the next level asks: say so, and where more come from.
  const short = next && stone.notMastered < next.from - stone.mastered;
  const polishedAt = stone.levels.find(({ level }) => level === 5)?.reachedAt;
  return (
    <section className="surface-panel flex items-center gap-6 p-6">
      <StoneGem dull={stone.dull} level={stone.level} size={112} />
      <div className="grid min-w-0 flex-1 gap-4">
        <div>
          <h2 className="font-heading text-2xl leading-snug">{levelTitle(stone.level)}</h2>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">
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
              <span className="text-foreground">
                <span className="tabular-nums">{stone.mastered}</span> itens dominados
              </span>
              {polishedAt && (
                <span className="text-muted-foreground">
                  polida desde {reachedDate.format(new Date(polishedAt))}
                </span>
              )}
            </div>
            <Progress aria-label="Domínio" className={goldBar} max={1} value={1} />
          </div>
        )}
        {short && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {stone.notMastered
                ? `Você tem ${stone.notMastered} ${stone.notMastered === 1 ? "item ainda não dominado" : "itens ainda não dominados"}. Para chegar a ${next.name}, crie mais materiais.`
                : `Tudo o que você tem já está dominado. Para chegar a ${next.name}, crie mais materiais.`}
            </p>
            <Button asChild size="sm" variant="outline">
              <Link to="/documents">Ir para projetos</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

const GoalPanel = ({ onEdit, stone }: { onEdit: () => void; stone: StoneResponse }) => (
  <section className="surface-panel grid content-start gap-4 p-6">
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">Meta diária</h2>
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
          {goalText(stone.goal)} · {goalDaysText(stone.goal)}
        </p>
      </div>
      <Button onClick={onEdit} size="sm" variant="outline">
        <PencilIcon aria-hidden="true" /> Editar meta
      </Button>
    </div>
    <GoalLine stone={stone} />
    <WeekLine stone={stone} />
  </section>
);

const facet = (size: string) => ({ "--facet-size": size }) as CSSProperties;

const DayMark = ({ day }: { day: StoneDay | null }) => {
  if (!day || day.status === "none") return <span className="size-2.5" />;
  const title = `${dayTitle.format(new Date(`${day.date}T12:00:00Z`))}: ${statusLabel[day.status]}`;
  if (day.status === "off")
    return (
      <span
        className="m-auto size-2 rounded-full border border-dashed border-muted-foreground/40"
        title={title}
      />
    );
  return (
    <span className="grid place-items-center" title={title}>
      <Facet
        state={day.status === "met" || day.status === "free" ? "active" : "idle"}
        style={facet("0.625rem")}
      />
    </span>
  );
};

/** Twelve weeks, one column each, Monday on top. */
const History = ({ days }: { days: StoneDay[] }) => {
  const cells: Array<StoneDay | null> = [...days];
  while (cells.length % 7) cells.push(null);
  return (
    <section className="surface-panel mt-4 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-sm font-semibold">Últimas 12 semanas</h2>
        <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Facet state="active" style={facet("0.5rem")} />
            Dia estudado
          </span>
          <span className="flex items-center gap-1.5">
            <Facet state="idle" style={facet("0.5rem")} />
            Sem a meta
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full border border-dashed border-muted-foreground/50" />
            Folga
          </span>
        </span>
      </div>
      <div className="mt-4 flex gap-3 overflow-x-auto overflow-y-hidden pb-1">
        <div className="grid grid-rows-7 gap-1.5 text-[0.6875rem] leading-[0.625rem] text-muted-foreground">
          {["S", "T", "Q", "Q", "S", "S", "D"].map((initial, index) => (
            <span className="grid h-2.5 place-items-center" key={index}>
              {initial}
            </span>
          ))}
        </div>
        <div className="grid w-fit grid-flow-col grid-rows-7 gap-1.5">
          {cells.map((day, index) => (
            <DayMark day={day} key={day?.date ?? `empty-${index}`} />
          ))}
        </div>
      </div>
    </section>
  );
};

const Projects = ({ stone }: { stone: StoneResponse }) => (
  <section className="surface-panel p-6">
    <h2 className="text-sm font-semibold">Domínio por projeto</h2>
    {stone.projects.length ? (
      <div className="mt-4 grid gap-4">
        {stone.projects.map((project) => (
          <div className="grid gap-1.5" key={project.projectId}>
            <div className="flex justify-between gap-3 text-xs">
              <Link
                className="truncate text-sm font-medium hover:underline"
                to={`/documents/${project.projectId}`}
              >
                {project.title}
              </Link>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {project.mastered} de {project.total} dominados
              </span>
            </div>
            <Progress
              aria-label={`Domínio de ${project.title}`}
              className={goldBar}
              max={Math.max(1, project.total)}
              value={project.mastered}
            />
          </div>
        ))}
      </div>
    ) : (
      <p className="mt-2 text-sm text-muted-foreground">
        Os projetos aparecem aqui quando tiverem flashcards ou questões.
      </p>
    )}
  </section>
);

const Levels = ({ stone }: { stone: StoneResponse }) => (
  <section className="surface-panel p-6">
    <h2 className="text-sm font-semibold">Níveis</h2>
    <ol className="mt-3 grid gap-0.5">
      {STONE_LEVELS.map((item) => {
        const current = item.level === stone.level;
        const reachedAt = stone.levels.find(({ level }) => level === item.level)?.reachedAt;
        return (
          <li
            aria-current={current ? "step" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-[var(--radius)] px-2 py-1.5",
              current && "bg-muted",
            )}
            key={item.level}
          >
            <CutGem cut={item.cut} size={28} />
            <span className={cn("flex-1 text-sm", current && "font-medium")}>{item.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {reachedAt && item.level <= stone.level
                ? `alcançado em ${reachedDate.format(new Date(reachedAt))}`
                : `com ${item.from} dominados`}
            </span>
          </li>
        );
      })}
    </ol>
  </section>
);

export const StonePage = () => {
  const stone = useStone();
  const [editing, setEditing] = useState(false);
  return (
    <ContentPage maxWidth="6xl">
      <h1 className="page-title">Sua pedra</h1>
      {stone.isPending ? (
        <div aria-busy="true" className="mt-6 grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : stone.isError || !stone.data ? (
        <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
          Não foi possível carregar sua pedra.
          <Button onClick={() => void stone.refetch()} size="sm" variant="outline">
            Tentar de novo
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <LevelPanel stone={stone.data} />
            <GoalPanel onEdit={() => setEditing(true)} stone={stone.data} />
          </div>
          <History days={stone.data.history} />
          <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
            <Projects stone={stone.data} />
            <Levels stone={stone.data} />
          </div>
          <StudyGoalDialog goal={stone.data.goal} onOpenChange={setEditing} open={editing} />
        </>
      )}
    </ContentPage>
  );
};

export default StonePage;
