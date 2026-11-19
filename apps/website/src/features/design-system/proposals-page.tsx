import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { Facet } from "@/components/brand-mark.tsx";
import { CutGem } from "@/components/brand/cut-gem.tsx";
import { ContentPage } from "@/components/content-page.tsx";
import { ArrowClockwiseIcon, PencilIcon } from "@/components/icons.tsx";
import { ForwardLink } from "@/components/nav-link.tsx";
import { StudyStrip, type StudyStripSegment } from "@/components/study-collection-card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group.tsx";
import { ViewSelector } from "@/components/view-selector.tsx";
import { cn } from "@/lib/utils.ts";
import "@/components/study-collection-card.css";
import "@/components/study-practice.css";

/*
 * Internal study page (development only): the whole gamification proposal, for approval. Where
 * each piece lives, the levels, the customizable goal, the "Sua pedra" screen, the home card, the
 * end of a session, collections and the project. Mocks with the real stone and styles; nothing
 * here reaches the app.
 */

/* Model --------------------------------------------------------------------------------------- */

/** Five levels, the five cuts the stone already has. Polida is a real achievement. */
const levels = [
  { level: 1, name: "Bruta", from: 0, cut: 0, reached: "19 out." },
  { level: 2, name: "Desbastada", from: 15, cut: 0.4, reached: "2 nov." },
  { level: 3, name: "Facetada", from: 50, cut: 0.62, reached: "14 nov." },
  { level: 4, name: "Lapidada", from: 150, cut: 0.85, reached: null },
  { level: 5, name: "Polida", from: 400, cut: 1, reached: null },
];
const levelFor = (mastered: number) =>
  [...levels].reverse().find(({ from }) => mastered >= from) ?? levels[0]!;
const nextLevel = (mastered: number) => levels.find(({ from }) => from > mastered);
/** The week keeps the shine: four or more studied days, full; fewer, it dulls (never the cut). */
const dullFor = (metDays: number) => Math.max(0, Math.min(1, (4 - metDays) / 4)) * 0.85;

const goldBar = "h-1.5 [&>[data-slot=progress-indicator]]:bg-[var(--gold)]";
const MASTERED = 62;
const MET_DAYS = 5;

/* Page scaffolding ---------------------------------------------------------------------------- */

const Section = ({
  children,
  note,
  title,
}: {
  children: ReactNode;
  note: string;
  title: string;
}) => (
  <section className="mt-16 first:mt-0">
    <h2 className="text-base font-semibold">{title}</h2>
    <p className="mt-1 mb-5 max-w-3xl text-sm text-muted-foreground">{note}</p>
    {children}
  </section>
);

const Option = ({
  children,
  label,
  note,
}: {
  children: ReactNode;
  label: string;
  note: string;
}) => (
  <div className="grid min-w-0 content-start gap-3">
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground md:min-h-[2lh]">{note}</p>
    </div>
    {children}
  </div>
);

/** The gray page a mock sits on, so surfaces read as in the app. */
const Page = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("rounded-[var(--radius-panel)] border bg-background p-6 sm:p-8", className)}>
    {children}
  </div>
);

/* Shared pieces ------------------------------------------------------------------------------- */

const WeekFacets = ({ metDays }: { metDays: number }) => (
  <span aria-hidden="true" className="flex items-center gap-1">
    {Array.from({ length: 7 }, (_, index) => (
      <Facet
        key={index}
        state={index >= 7 - metDays ? "active" : "idle"}
        style={{ "--facet-size": "0.4375rem" } as CSSProperties}
      />
    ))}
  </span>
);

const MasteryLine = ({ mastered }: { mastered: number }) => {
  const level = levelFor(mastered);
  const next = nextLevel(mastered);
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between gap-3 text-xs">
        <span className="text-foreground">
          <span className="tabular-nums">{mastered}</span> itens dominados
        </span>
        <span className="text-muted-foreground tabular-nums">
          {next ? `faltam ${next.from - mastered} para o nível ${next.level}` : "nível máximo"}
        </span>
      </div>
      <Progress
        aria-label="Domínio até o próximo nível"
        className={goldBar}
        max={next ? next.from - level.from : 1}
        value={next ? mastered - level.from : 1}
      />
    </div>
  );
};

const GoalLine = ({ done, goal }: { done: number; goal: Goal }) => (
  <div className="grid gap-1.5">
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-foreground">Meta de hoje</span>
      <span className="text-muted-foreground tabular-nums">
        {done >= goal.value ? "cumprida" : `${done} de ${goalText(goal)}`}
      </span>
    </div>
    <Progress aria-label="Meta de hoje" className="h-1.5" max={goal.value} value={done} />
  </div>
);

/* 1 · Map ------------------------------------------------------------------------------------- */

const placements = [
  [
    "Início",
    "O cartão “Sua pedra”: a pedra, o nível, a meta de hoje e a semana. Abre a tela “Sua pedra”.",
  ],
  [
    "Tela “Sua pedra” (nova)",
    "Tudo em detalhe: nível e o caminho até o próximo, a meta (e onde editá-la), as últimas 12 semanas, o domínio de cada projeto e os níveis alcançados.",
  ],
  [
    "Fim da prática e do quiz",
    "O que a sessão somou (meta de hoje antes e depois, itens que passaram a ser dominados). Se o nível subiu, o aviso aparece aqui, no topo.",
  ],
  ["Coleções", "Na faixa de cada coleção, os itens dominados em ouro."],
  ["Página do projeto", "No “Estudo deste projeto”, quantos itens do projeto você já domina."],
  ["Configurações › Estudo", "A mesma meta da tela “Sua pedra”, para quem procura por lá."],
];

/* 2 · Levels ---------------------------------------------------------------------------------- */

const LevelRow = ({ size }: { size: number }) => (
  <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
    {levels.map((item) => (
      <div className="grid justify-items-center gap-2 text-center" key={item.level}>
        <CutGem cut={item.cut} size={size} />
        <span className="text-xs">
          <span className="block font-medium">{item.name}</span>
          <span className="text-muted-foreground tabular-nums">
            {item.from === 0 ? "início" : `${item.from} dominados`}
          </span>
        </span>
      </div>
    ))}
  </div>
);

/* 3 · Goal ------------------------------------------------------------------------------------ */

type Goal = {
  counts: "both" | "flashcards" | "questions";
  measure: "count" | "time";
  value: number;
  days: boolean[];
};
const countsLabel = {
  both: "revisões ou questões",
  flashcards: "revisões de flashcards",
  questions: "questões",
};
const goalText = (goal: Goal) =>
  goal.measure === "time" ? `${goal.value} min` : `${goal.value} ${countsLabel[goal.counts]}`;
const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Suggestions from the person's own data: what is due each day and their recent pace. */
const suggestions = {
  count: [
    { id: "light", title: "Leve", value: 12, why: "Dá conta das revisões que vencem por dia." },
    { id: "medium", title: "Média", value: 20, why: "As revisões do dia e alguns itens novos." },
    { id: "intense", title: "Intensa", value: 35, why: "Acima do seu ritmo das últimas semanas." },
  ],
  time: [
    { id: "light", title: "Leve", value: 10, why: "O tempo das revisões que vencem por dia." },
    {
      id: "medium",
      title: "Média",
      value: 20,
      why: "Revisões do dia e um pouco de material novo.",
    },
    { id: "intense", title: "Intensa", value: 40, why: "Acima do seu ritmo das últimas semanas." },
  ],
};

const GoalEditor = ({ goal, onChange }: { goal: Goal; onChange: (goal: Goal) => void }) => {
  const options = suggestions[goal.measure];
  const preset = options.find(({ value }) => value === goal.value)?.id ?? "custom";
  const unit =
    goal.measure === "time"
      ? "minutos"
      : goal.counts === "questions"
        ? "questões"
        : goal.counts === "flashcards"
          ? "revisões"
          : "revisões ou questões";
  return (
    <div className="grid gap-5 text-sm">
      <div className="grid gap-2">
        <Label asChild>
          <p>O que conta</p>
        </Label>
        <ViewSelector
          fullWidth
          label="O que conta"
          onChange={(value) => onChange({ ...goal, counts: value as Goal["counts"] })}
          options={[
            { value: "both", label: "Ambos" },
            { value: "flashcards", label: "Flashcards" },
            { value: "questions", label: "Questões" },
          ]}
          value={goal.counts}
        />
      </div>
      <div className="grid gap-2">
        <Label asChild>
          <p>Medir por</p>
        </Label>
        <ViewSelector
          fullWidth
          label="Medir por"
          onChange={(value) =>
            onChange({
              ...goal,
              measure: value as Goal["measure"],
              value: suggestions[value as Goal["measure"]][1]!.value,
            })
          }
          options={[
            { value: "count", label: "Quantidade" },
            { value: "time", label: "Tempo" },
          ]}
          value={goal.measure}
        />
      </div>
      <div className="grid gap-2">
        <Label asChild>
          <p>Quanto por dia</p>
        </Label>
        <RadioGroup
          className="grid gap-2"
          onValueChange={(id) => {
            const picked = options.find((option) => option.id === id);
            onChange({ ...goal, value: picked ? picked.value : goal.value + 1 });
          }}
          value={preset}
        >
          {options.map((option) => (
            <RadioCard
              description={option.why}
              key={option.id}
              title={`${option.title} · ${option.value} ${goal.measure === "time" ? "min" : unit}`}
              value={option.id}
            />
          ))}
          <RadioCard description="Escolha o seu número." title="Personalizada" value="custom" />
        </RadioGroup>
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              aria-label="Meta personalizada"
              className="w-24"
              min={1}
              onChange={(event) =>
                onChange({ ...goal, value: Math.max(1, Number(event.target.value) || 1) })
              }
              type="number"
              value={goal.value}
            />
            <span className="text-muted-foreground">{unit} por dia</span>
          </div>
        )}
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
              key={day}
              onClick={() =>
                onChange({
                  ...goal,
                  days: goal.days.map((value, at) => (at === index ? !value : value)),
                })
              }
              size="sm"
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
        Um dia conta como estudado com {goalText(goal)}
        {goal.measure === "count" ? ", ou quando você zera as revisões pendentes" : ""}.
      </p>
    </div>
  );
};

/* 4 · The "Sua pedra" screen ------------------------------------------------------------------ */

/** Twelve weeks, a facet per day: lapis for a studied day, empty for a day off. */
const history = Array.from({ length: 84 }, (_, index) => {
  const weekday = index % 7;
  const week = Math.floor(index / 7);
  if (weekday === 6) return "off" as const;
  return (week * 7 + weekday * 3) % 5 === 0 ? ("missed" as const) : ("met" as const);
});

const StoneScreen = ({ goal, onEditGoal }: { goal: Goal; onEditGoal: () => void }) => {
  const level = levelFor(MASTERED);
  return (
    <Page>
      <h3 className="page-title">Sua pedra</h3>
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="surface-panel flex items-center gap-6 p-6">
          <CutGem cut={level.cut} dull={dullFor(MET_DAYS)} size={112} />
          <div className="grid min-w-0 flex-1 gap-4">
            <div>
              <p className="font-heading text-2xl leading-snug">
                Nível {level.level} · {level.name}
              </p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                O corte vem do que você domina e não volta atrás. O brilho vem da sua semana.
              </p>
            </div>
            <MasteryLine mastered={MASTERED} />
          </div>
        </section>
        <section className="surface-panel grid content-start gap-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold">Meta diária</h4>
              <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                {goalText(goal)} ·{" "}
                {goal.days.every(Boolean)
                  ? "todos os dias"
                  : weekdays.filter((_, index) => goal.days[index]).join(", ")}
              </p>
            </div>
            <Button onClick={onEditGoal} size="sm" variant="outline">
              <PencilIcon aria-hidden="true" /> Editar meta
            </Button>
          </div>
          <GoalLine done={12} goal={goal} />
          <div className="flex items-center gap-2 text-xs text-foreground">
            <WeekFacets metDays={MET_DAYS} />
            {MET_DAYS} dias estudados nos últimos 7
          </div>
        </section>
      </div>
      <section className="surface-panel mt-4 p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h4 className="text-sm font-semibold">Últimas 12 semanas</h4>
          <span className="flex items-center gap-3 text-xs text-muted-foreground">
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
        <div className="mt-4 flex gap-3">
          <div className="grid grid-rows-7 gap-1.5 text-[0.6875rem] leading-[0.625rem] text-muted-foreground">
            {["S", "T", "Q", "Q", "S", "S", "D"].map((initial, index) => (
              <span className="grid h-2.5 place-items-center" key={index}>
                {initial}
              </span>
            ))}
          </div>
          <div className="grid w-fit grid-flow-col grid-rows-7 gap-1.5">
            {history.map((day, index) =>
              day === "off" ? (
                <span
                  className="m-auto size-2 rounded-full border border-dashed border-muted-foreground/40"
                  key={index}
                />
              ) : (
                <Facet
                  key={index}
                  state={day === "met" ? "active" : "idle"}
                  style={{ "--facet-size": "0.625rem" } as CSSProperties}
                />
              ),
            )}
          </div>
        </div>
      </section>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="surface-panel p-6">
          <h4 className="text-sm font-semibold">Domínio por projeto</h4>
          <div className="mt-4 grid gap-4">
            {[
              ["Exemplo: aprendendo a aprender", 24, 40],
              ["Fisiologia: sistema cardiovascular", 31, 86],
              ["Cálculo I", 7, 52],
            ].map(([title, done, total]) => (
              <div className="grid gap-1.5" key={title as string}>
                <div className="flex justify-between gap-3 text-xs">
                  <span className="truncate text-sm font-medium">{title}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {done} de {total} dominados
                  </span>
                </div>
                <Progress className={goldBar} max={total as number} value={done as number} />
              </div>
            ))}
          </div>
        </section>
        <section className="surface-panel p-6">
          <h4 className="text-sm font-semibold">Níveis</h4>
          <ol className="mt-3 grid gap-0.5">
            {levels.map((item) => {
              const current = item.level === level.level;
              return (
                <li
                  className={cn(
                    "flex items-center gap-3 rounded-[var(--radius)] px-2 py-1.5",
                    current && "bg-muted",
                  )}
                  key={item.level}
                >
                  <CutGem cut={item.cut} size={28} />
                  <span className={cn("flex-1 text-sm", current && "font-medium")}>
                    {item.name}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {item.reached ? `alcançado em ${item.reached}` : `com ${item.from} dominados`}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </Page>
  );
};

/* 5 · Home card ------------------------------------------------------------------------------- */

const HomeCard = ({ goal }: { goal: Goal }) => {
  const level = levelFor(MASTERED);
  return (
    <Page>
      <section className="surface-panel flex items-center gap-6 p-6">
        <CutGem cut={level.cut} dull={dullFor(MET_DAYS)} size={84} />
        <div className="grid min-w-0 flex-1 gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">Sua pedra</h3>
            <ForwardLink to="/system/propostas">Ver sua pedra</ForwardLink>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Nível {level.level} · {level.name}
          </p>
          <MasteryLine mastered={MASTERED} />
          <GoalLine done={12} goal={goal} />
          <div className="flex items-center gap-2 text-xs text-foreground">
            <WeekFacets metDays={MET_DAYS} />
            {MET_DAYS} dias estudados nos últimos 7
          </div>
        </div>
      </section>
    </Page>
  );
};

/* 6 · End of a session ------------------------------------------------------------------------ */

const useTween = (from: number, to: number, run: number, duration = 1100, delay = 250) => {
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }
    setValue(from);
    let frame = 0;
    const start = performance.now() + delay;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setValue(from + (to - from) * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [delay, duration, from, run, to]);
  return value;
};

const RisingStone = ({ run, size }: { run: number; size: number }) => {
  const cut = useTween(0.4, 0.62, run);
  return <CutGem cut={cut} size={size} />;
};

const Contribution = ({
  after,
  before,
  goal,
  toNext,
}: {
  after: number;
  before: number;
  goal: Goal;
  /** Items still to master for the next level. */
  toNext: number;
}) => (
  <div className="grid gap-4 border-t pt-5 sm:grid-cols-2 sm:gap-6">
    <div className="grid gap-1.5">
      <div className="flex justify-between gap-3 text-xs">
        <span className="text-foreground">Meta de hoje</span>
        <span className="text-muted-foreground tabular-nums">
          {after >= goal.value ? "cumprida" : `${before} → ${after} de ${goal.value}`}
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
        <span
          className="absolute inset-y-0 left-0 bg-primary/45"
          style={{ width: `${(Math.min(before, goal.value) / goal.value) * 100}%` }}
        />
        <span
          className="absolute inset-y-0 bg-primary"
          style={{
            left: `${(Math.min(before, goal.value) / goal.value) * 100}%`,
            width: `${((Math.min(after, goal.value) - Math.min(before, goal.value)) / goal.value) * 100}%`,
          }}
        />
      </div>
    </div>
    <div className="grid gap-1.5">
      <div className="flex justify-between gap-3 text-xs">
        <span className="text-foreground">+3 dominados</span>
        <span className="text-muted-foreground tabular-nums">faltam {toNext} para o nível 4</span>
      </div>
      <Progress className={goldBar} max={100} value={100 - toNext} />
    </div>
  </div>
);

const SummaryShell = ({ children }: { children: ReactNode }) => (
  <div className="rounded-[var(--radius-panel)] border bg-background p-6">
    <section className="practice-sheet result-summary">{children}</section>
  </div>
);

const SummaryHead = () => (
  <div className="result-head">
    <div>
      <p className="page-title">12 flashcards revisados</p>
      <p className="result-subtitle">10 lembrados · 2 ainda disponíveis</p>
    </div>
    <div className="practice-actions">
      <Button>Voltar à coleção</Button>
    </div>
  </div>
);

/* 7 · Collections and project ----------------------------------------------------------------- */

const stripNow: StudyStripSegment[] = [
  { count: 2, label: "para revisar", tone: "due" },
  { count: 13, label: "em dia", tone: "rest" },
  { count: 3, label: "novos", tone: "new" },
];
const stripGold: StudyStripSegment[] = [
  { count: 6, label: "dominados", tone: "mastered" },
  { count: 2, label: "para revisar", tone: "due" },
  { count: 7, label: "em dia", tone: "rest" },
  { count: 3, label: "novos", tone: "new" },
];

/* Page ---------------------------------------------------------------------------------------- */

export default function ProposalsPage() {
  const [goal, setGoal] = useState<Goal>({
    counts: "both",
    measure: "count",
    value: 20,
    days: [true, true, true, true, true, true, false],
  });
  const [run, setRun] = useState(0);
  const [editing, setEditing] = useState(false);
  return (
    <ContentPage maxWidth="6xl">
      <h1 className="page-title">Propostas</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Gamificação, para aprovação. Nada aqui está aplicado no app.
      </p>

      <section className="surface-panel mt-8 grid gap-4 p-6 text-sm md:grid-cols-3">
        <div>
          <p className="font-semibold">Domínio dá o nível</p>
          <p className="mt-1 text-muted-foreground">
            Cada item que você passa a dominar soma. Um flashcard conta quando a revisão já o agenda
            para 21 dias ou mais; uma questão, quando você a acerta em duas tentativas, em dias
            diferentes. O nível nunca cai.
          </p>
        </div>
        <div>
          <p className="font-semibold">A semana dá o brilho</p>
          <p className="mt-1 text-muted-foreground">
            Os dias em que você cumpre a sua meta nos últimos 7. Com menos de 4 a pedra fica fosca,
            sem perder o corte; volta a brilhar quando você volta a estudar.
          </p>
        </div>
        <div>
          <p className="font-semibold">A meta é sua</p>
          <p className="mt-1 text-muted-foreground">
            O que conta, se por quantidade ou por tempo, quanto por dia e em quais dias. Com
            sugestões leve, média e intensa calculadas do seu próprio estudo.
          </p>
        </div>
      </section>

      <Section
        note="Uma tela nova, “Sua pedra”, reúne tudo; o resto do app mostra só o que pertence a cada lugar."
        title="Onde cada coisa aparece"
      >
        <div className="max-w-4xl overflow-hidden rounded-[var(--radius-panel)] border bg-card">
          {placements.map(([place, what]) => (
            <div
              className="grid gap-1 border-b px-5 py-3.5 text-sm last:border-b-0 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6"
              key={place}
            >
              <span className="font-medium">{place}</span>
              <span className="text-muted-foreground">{what}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        note="Cinco níveis, os cinco cortes que a pedra já tem. Não acrescentaria níveis de polimento agora: além de Polida as diferenças ficam pequenas demais para ler, e 400 itens dominados já é uma conquista grande. Se muita gente chegar lá, abrimos outra etapa com uma diferença clara. Os limites crescem: cada nível pede mais que o anterior."
        title="Os níveis"
      >
        <div className="grid gap-6">
          <Option label="No tamanho do Início (84px)" note="Cada corte se distingue do anterior.">
            <div className="surface-panel p-6">
              <LevelRow size={84} />
            </div>
          </Option>
          <Option
            label="No tamanho de lista (28px)"
            note="Pequena, a diferença entre os três últimos fica sutil: por isso o nome sempre acompanha a pedra, e o momento de subir de nível usa o tamanho grande."
          >
            <div className="surface-panel p-6">
              <LevelRow size={28} />
            </div>
          </Option>
          <Option
            label="O brilho pela semana"
            note="Mesmo nível (Facetada), semanas diferentes: o corte fica, o brilho acompanha os dias estudados."
          >
            <div className="surface-panel flex flex-wrap gap-8 p-6">
              {[6, 3, 1, 0].map((days) => (
                <div className="flex items-center gap-3" key={days}>
                  <CutGem cut={0.62} dull={dullFor(days)} size={56} />
                  <span className="text-xs text-muted-foreground">
                    {days} {days === 1 ? "dia estudado" : "dias estudados"}
                  </span>
                </div>
              ))}
            </div>
          </Option>
        </div>
      </Section>

      <Section
        note="Abre em “Editar meta”, na tela “Sua pedra” (e em Configurações › Estudo). As sugestões vêm do que vence por dia na sua biblioteca e do seu ritmo recente; o resto é escolha sua. Experimente: a tela abaixo acompanha."
        title="Meta diária personalizável"
      >
        <div className="grid items-start gap-8 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div className="w-full overflow-hidden rounded-[var(--radius-panel)] border bg-popover shadow-[var(--shadow-overlay)]">
            <div className="px-6 pt-6">
              <p className="text-lg font-semibold">Editar meta diária</p>
              <p className="mt-1 text-sm text-muted-foreground">
                O que conta como um dia estudado para a sua pedra.
              </p>
            </div>
            <div className="px-6 pt-5 pb-6">
              <GoalEditor goal={goal} onChange={setGoal} />
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <Button size="sm" variant="outline">
                Cancelar
              </Button>
              <Button size="sm">Salvar meta</Button>
            </div>
          </div>
          <div className="grid content-start gap-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Por tempo:</span> conta o tempo dentro
              de práticas e quizzes, não o tempo com o app aberto.
            </p>
            <p>
              <span className="font-medium text-foreground">Zerar as pendentes</span> continua
              valendo como dia estudado na meta por quantidade, para que um dia com pouco a revisar
              não pareça perdido.
            </p>
            <p>
              <span className="font-medium text-foreground">Mudar a meta</span> vale de hoje em
              diante; os dias passados ficam como foram.
            </p>
            {editing && (
              <p className="text-foreground">
                (Na tela abaixo, “Editar meta” abre este mesmo formulário.)
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section
        note="Uma tela própria, aberta pelo cartão do Início (“Ver sua pedra”). Não entra no menu lateral para não disputar lugar com Projetos, Flashcards e Quizzes; se você preferir no menu, é um item a mais."
        title="Tela “Sua pedra”"
      >
        <StoneScreen goal={goal} onEditGoal={() => setEditing(true)} />
      </Section>

      <Section
        note="O cartão de hoje ganha o nível e a linha em ouro do domínio; a meta segue a que você escolher. O detalhe da semana fica na tela “Sua pedra”."
        title="Início"
      >
        <div className="max-w-2xl">
          <HomeCard goal={goal} />
        </div>
      </Section>

      <Section
        note="No fim de toda prática e todo quiz, o que a sessão somou. Quando o nível sobe, o aviso aparece ali; a pedra ganha o corte novo em pouco mais de um segundo, sem confete nem som. Criar materiais não conta."
        title="Fim da prática e do quiz"
      >
        <Button className="mb-4" onClick={() => setRun(run + 1)} size="xs" variant="outline">
          <ArrowClockwiseIcon aria-hidden="true" /> Repetir animação
        </Button>
        <div className="grid items-start gap-8 md:grid-cols-2">
          <Option
            label="Sessão comum"
            note="Abaixo do resultado: a meta de hoje antes e depois, e os novos dominados até o próximo nível."
          >
            <SummaryShell>
              <SummaryHead />
              <Contribution after={18} before={6} goal={goal} toNext={88} />
            </SummaryShell>
          </Option>
          <Option
            label="Quando o nível sobe"
            note="O aviso abre o próprio resumo, no mesmo cartão; a sessão continua logo abaixo."
          >
            <SummaryShell>
              <div className="flex items-center gap-5 border-b pb-6">
                <RisingStone run={run} size={72} />
                <div className="min-w-0">
                  <p className="font-heading text-xl leading-snug">Nível 3 · Facetada</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    50 itens dominados. A pedra ganhou mais um corte.
                  </p>
                </div>
              </div>
              <div className="pt-6">
                <SummaryHead />
              </div>
              <Contribution after={24} before={18} goal={goal} toNext={100} />
            </SummaryShell>
          </Option>
        </div>
      </Section>

      <Section
        note="O ouro só marca o que é dominado: na faixa de cada coleção e no estudo de cada projeto."
        title="Coleções e projeto"
      >
        <div className="grid items-start gap-8 md:grid-cols-2">
          <Option label="Faixa da coleção, hoje" note="Em dia, para revisar e novos.">
            <div className="surface-panel p-5">
              <StudyStrip
                emptyLabel=""
                label="Hoje"
                noun={{ singular: "flashcard", plural: "flashcards" }}
                segments={stripNow}
              />
            </div>
          </Option>
          <Option
            label="Com dominados"
            note="Os dominados saem de “em dia” e vêm primeiro, em ouro."
          >
            <div className="surface-panel p-5">
              <StudyStrip
                emptyLabel=""
                label="Com dominados"
                noun={{ singular: "flashcard", plural: "flashcards" }}
                segments={stripGold}
              />
            </div>
          </Option>
          <Option
            label="Estudo deste projeto"
            note="Uma linha a mais no painel do projeto: quanto dele você já domina."
          >
            <div className="surface-panel grid gap-4 p-6">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="text-sm font-semibold">Estudo deste projeto</p>
                  <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                    2 flashcards para revisar
                  </p>
                </div>
                <Button size="sm">Praticar flashcards</Button>
              </div>
              <div className="grid gap-1.5">
                <div className="flex justify-between text-xs">
                  <span>24 de 40 itens dominados</span>
                  <span className="text-muted-foreground">60%</span>
                </div>
                <Progress className={goldBar} max={40} value={24} />
              </div>
            </div>
          </Option>
        </div>
      </Section>
    </ContentPage>
  );
}
