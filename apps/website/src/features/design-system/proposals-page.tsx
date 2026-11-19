import { useEffect, useRef, useState, type ReactNode } from "react";

import { Facet } from "@/components/brand-mark.tsx";
import { CutGem } from "@/components/brand/cut-gem.tsx";
import { ContentPage } from "@/components/content-page.tsx";
import { ArrowClockwiseIcon } from "@/components/icons.tsx";
import { StudyStrip, type StudyStripSegment } from "@/components/study-collection-card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { cn } from "@/lib/utils.ts";
import "@/components/study-collection-card.css";
import "@/components/study-practice.css";

/*
 * Internal study page (development only): the gamification model for approval. Two measures on
 * one stone (mastery cuts it for good, the week's rhythm keeps its shine), the level-up moment,
 * the contribution block at the end of a session and gold for what is mastered. Mocks drawn with
 * the real stone, strip and summary styles; nothing here reaches the app.
 */

/* Model --------------------------------------------------------------------------------------- */

/** Levels by items mastered: a flashcard scheduled weeks ahead, a question right twice. */
const levels = [
  { level: 1, name: "Bruta", from: 0, cut: 0, flecks: 0 },
  { level: 2, name: "Desbastada", from: 10, cut: 0.25, flecks: 0 },
  { level: 3, name: "Facetada", from: 25, cut: 0.5, flecks: 0 },
  { level: 4, name: "Lapidada", from: 50, cut: 0.75, flecks: 0 },
  { level: 5, name: "Polida", from: 100, cut: 1, flecks: 0 },
  { level: 6, name: "Polida, com pirita", from: 200, cut: 1, flecks: 1 },
  { level: 7, name: "Polida, com pirita", from: 400, cut: 1, flecks: 2 },
  { level: 8, name: "Polida, com pirita", from: 800, cut: 1, flecks: 3 },
];

const levelFor = (mastered: number) =>
  [...levels].reverse().find(({ from }) => mastered >= from) ?? levels[0]!;
const nextLevel = (mastered: number) => levels.find(({ from }) => from > mastered);

/** Shine from the week: four or more studied days keep it; fewer let it dull. */
const dullFor = (metDays: number) => Math.max(0, Math.min(1, (4 - metDays) / 4)) * 0.85;

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
  <section className="mt-14 first:mt-0">
    <h2 className="text-sm font-semibold">{title}</h2>
    <p className="mt-0.5 mb-5 max-w-3xl text-[0.8125rem] text-muted-foreground">{note}</p>
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
      <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground md:min-h-[3lh]">{note}</p>
    </div>
    {children}
  </div>
);

const ReplayButton = ({ onReplay }: { onReplay: () => void }) => (
  <Button className="w-fit" onClick={onReplay} size="xs" variant="outline">
    <ArrowClockwiseIcon aria-hidden="true" /> Repetir animação
  </Button>
);

/* A · One stone, two measures ------------------------------------------------------------------ */

const WeekDots = ({ metDays }: { metDays: number }) => (
  <span aria-hidden="true" className="flex items-center gap-1">
    {Array.from({ length: 7 }, (_, index) => (
      <Facet
        key={index}
        state={index >= 7 - metDays ? "active" : "idle"}
        style={{ "--facet-size": "0.4375rem" } as React.CSSProperties}
      />
    ))}
  </span>
);

const StoneCardA = ({
  mastered,
  metDays,
  todayActions,
}: {
  mastered: number;
  metDays: number;
  todayActions: number;
}) => {
  const level = levelFor(mastered);
  const next = nextLevel(mastered);
  const toNext = next ? next.from - mastered : 0;
  return (
    <section className="surface-panel flex items-center gap-6 p-6">
      <CutGem cut={level.cut} dull={dullFor(metDays)} flecks={level.flecks} size={84} />
      <div className="grid min-w-0 flex-1 gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold">Sua pedra</h3>
          <span className="text-xs text-muted-foreground">
            Nível {level.level} · {level.name}
          </span>
        </div>
        <div className="grid gap-1.5">
          <div className="flex justify-between gap-3 text-xs">
            <span className="text-foreground">
              <span className="tabular-nums">{mastered}</span> itens dominados
            </span>
            <span className="text-muted-foreground tabular-nums">
              {next ? `faltam ${toNext} para o nível ${next.level}` : "nível máximo"}
            </span>
          </div>
          <Progress
            aria-label="Domínio até o próximo nível"
            className="h-1.5 [&>[data-slot=progress-indicator]]:bg-[var(--gold)]"
            max={next ? next.from - level.from : 1}
            value={next ? mastered - level.from : 1}
          />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-foreground">
              <WeekDots metDays={metDays} />
              {metDays} {metDays === 1 ? "dia estudado" : "dias estudados"} nos últimos 7
            </span>
            <span className="text-muted-foreground tabular-nums">
              Meta de hoje {Math.min(todayActions, 20)} de 20
            </span>
          </div>
          <Progress
            aria-label="Meta de hoje"
            className="h-1.5"
            max={20}
            value={Math.min(todayActions, 20)}
          />
        </div>
      </div>
    </section>
  );
};

/* B · Two pieces -------------------------------------------------------------------------------- */

const StoneCardB = ({
  mastered,
  metDays,
  todayActions,
}: {
  mastered: number;
  metDays: number;
  todayActions: number;
}) => {
  const level = levelFor(mastered);
  const next = nextLevel(mastered);
  // Today's stone: cut by the week, as the app does now.
  const weekCut = [0, 0.25, 0.4, 0.5, 0.65, 0.75, 0.9, 1][metDays] ?? 0;
  return (
    <section className="surface-panel grid gap-5 p-6">
      <div className="flex items-center gap-5">
        <CutGem cut={weekCut} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">Sua pedra</h3>
            <span className="text-xs text-muted-foreground">
              {metDays} {metDays === 1 ? "dia" : "dias"} nos últimos 7
            </span>
          </div>
          <div className="mt-3 flex justify-between text-xs text-muted-foreground">
            <span>Meta de hoje</span>
            <span className="tabular-nums">{Math.min(todayActions, 20)} de 20</span>
          </div>
          <Progress className="mt-1.5 h-1.5" max={20} value={Math.min(todayActions, 20)} />
        </div>
      </div>
      <div className="flex items-center gap-4 border-t pt-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full border text-sm font-semibold tabular-nums">
          {level.level}
        </span>
        <div className="grid min-w-0 flex-1 gap-1.5">
          <div className="flex justify-between gap-3 text-xs">
            <span>
              Nível {level.level} · <span className="tabular-nums">{mastered}</span> dominados
            </span>
            <span className="text-muted-foreground tabular-nums">
              {next ? `próximo com ${next.from}` : "nível máximo"}
            </span>
          </div>
          <Progress
            className="h-1.5 [&>[data-slot=progress-indicator]]:bg-[var(--gold)]"
            max={next ? next.from - level.from : 1}
            value={next ? mastered - level.from : 1}
          />
        </div>
      </div>
    </section>
  );
};

/* Ladder and shine ----------------------------------------------------------------------------- */

const Ladder = () => (
  <ol className="surface-panel grid gap-0.5 p-3 sm:grid-cols-2 sm:gap-x-6">
    {levels.map((item) => (
      <li className="flex items-center gap-3 rounded-[var(--radius)] px-2 py-1.5" key={item.level}>
        <CutGem cut={item.cut} flecks={item.flecks} size={30} />
        <span className="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">
          Nível {item.level}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {item.from === 0 ? "início" : `${item.from} dominados`}
        </span>
      </li>
    ))}
  </ol>
);

const ShineDemo = () => (
  <div className="surface-panel grid gap-4 p-5 sm:grid-cols-3">
    {[6, 2, 0].map((days) => (
      <div className="flex items-center gap-3" key={days}>
        <CutGem cut={0.75} dull={dullFor(days)} size={52} />
        <div className="text-xs">
          <p className="font-medium text-foreground">Nível 4 · Lapidada</p>
          <p className="mt-0.5 text-muted-foreground">
            {days} {days === 1 ? "dia estudado" : "dias estudados"} na semana
          </p>
        </div>
      </div>
    ))}
  </div>
);

/* Level up ------------------------------------------------------------------------------------- */

/** A number moving from one value to another, eased, restarting with `run`. */
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
      const eased = 1 - (1 - t) ** 3;
      setValue(from + (to - from) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [delay, duration, from, run, to]);
  return value;
};

/** The stone taking its new cut: the cut eases in, then light settles on it once. */
const RisingStone = ({ run, size }: { run: number; size: number }) => {
  const cut = useTween(0.5, 0.75, run);
  return (
    <span className="level-up-stone" key={run}>
      <CutGem cut={cut} size={size} />
    </span>
  );
};

const SummaryShell = ({ children }: { children: ReactNode }) => (
  <div className="rounded-[var(--radius-panel)] border bg-background p-6">
    <section className="practice-sheet result-summary">{children}</section>
  </div>
);

/** A: the new level opens the session's summary, in the same card, above what happened. */
const LevelUpInline = ({ run }: { run: number }) => (
  <SummaryShell>
    <div className="flex items-center gap-5 border-b pb-6">
      <RisingStone run={run} size={72} />
      <div className="min-w-0">
        <p className="font-heading text-xl leading-snug">Nível 4 · Lapidada</p>
        <p className="mt-1 text-sm text-muted-foreground">
          50 itens dominados. A pedra ganhou mais um corte.
        </p>
      </div>
    </div>
    <div className="result-head pt-6">
      <div>
        <h3 className="page-title">12 flashcards revisados</h3>
        <p className="result-subtitle">10 lembrados · nada pendente no projeto</p>
      </div>
      <div className="practice-actions">
        <Button>Voltar ao projeto</Button>
      </div>
    </div>
  </SummaryShell>
);

/** B: a moment of its own before the summary, then "Ver resumo". */
const LevelUpMoment = ({ run }: { run: number }) => (
  <SummaryShell>
    <div className="grid justify-items-center gap-4 py-6 text-center">
      <RisingStone run={run} size={112} />
      <div>
        <p className="font-heading text-2xl leading-snug">Nível 4 · Lapidada</p>
        <p className="mt-1 text-sm text-muted-foreground">
          50 itens dominados. A pedra ganhou mais um corte.
        </p>
      </div>
      <Button className="mt-2">Ver resumo</Button>
    </div>
  </SummaryShell>
);

/* Contribution --------------------------------------------------------------------------------- */

/** What the session added, the same block at the end of a practice or a quiz. */
const Contribution = ({
  after,
  before,
  newlyMastered,
}: {
  after: number;
  before: number;
  newlyMastered: number;
}) => {
  const level = levelFor(41 + newlyMastered);
  const next = nextLevel(41 + newlyMastered);
  return (
    <div className="grid gap-4 border-t pt-5 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-6">
      <CutGem cut={level.cut} size={44} />
      <div className="grid gap-1.5">
        <div className="flex justify-between gap-3 text-xs">
          <span className="text-foreground">Meta de hoje</span>
          <span className="text-muted-foreground tabular-nums">
            {after >= 20 ? "cumprida" : `${before} → ${after} de 20`}
          </span>
        </div>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-primary/45"
            style={{ width: `${(Math.min(before, 20) / 20) * 100}%` }}
          />
          <span
            className="absolute inset-y-0 rounded-full bg-primary"
            style={{
              left: `${(Math.min(before, 20) / 20) * 100}%`,
              width: `${((Math.min(after, 20) - Math.min(before, 20)) / 20) * 100}%`,
            }}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <div className="flex justify-between gap-3 text-xs">
          <span className="text-foreground">
            +{newlyMastered} {newlyMastered === 1 ? "dominado" : "dominados"}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {next ? `faltam ${next.from - 41 - newlyMastered} para o nível ${next.level}` : ""}
          </span>
        </div>
        <Progress
          className="h-1.5 [&>[data-slot=progress-indicator]]:bg-[var(--gold)]"
          max={next ? next.from - level.from : 1}
          value={next ? 41 + newlyMastered - level.from : 1}
        />
      </div>
    </div>
  );
};

/* Strip --------------------------------------------------------------------------------------- */

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
  const [run, setRun] = useState(0);
  const [mastered, setMastered] = useState(41);
  const [metDays, setMetDays] = useState(5);
  const firstRun = useRef(true);
  useEffect(() => {
    firstRun.current = false;
  }, []);
  return (
    <ContentPage maxWidth="6xl">
      <h1 className="page-title">Propostas</h1>
      <p className="mt-1 mb-10 text-sm text-muted-foreground">
        Gamificação, para aprovação. Nada aqui está aplicado no app.
      </p>

      <Section
        note="Duas medidas com papéis diferentes. Domínio: quantos itens você domina (um flashcard que a revisão já agenda para 21 dias ou mais, uma questão acertada em duas tentativas em dias diferentes). Ele dá o nível, que nunca cai. Ritmo: os dias estudados nos últimos 7, como hoje; sobe e desce. Use os controles para ver os estados."
        title="Sua pedra: domínio e ritmo"
      >
        <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
          <label className="flex items-center gap-2">
            Itens dominados
            <input
              className="w-40"
              max={420}
              min={0}
              onChange={(event) => setMastered(Number(event.target.value))}
              type="range"
              value={mastered}
            />
            <span className="w-8 tabular-nums">{mastered}</span>
          </label>
          <label className="flex items-center gap-2">
            Dias estudados na semana
            <input
              className="w-28"
              max={7}
              min={0}
              onChange={(event) => setMetDays(Number(event.target.value))}
              type="range"
              value={metDays}
            />
            <span className="w-4 tabular-nums">{metDays}</span>
          </label>
        </div>
        <div className="grid items-start gap-8 md:grid-cols-2">
          <Option
            label="A · Uma pedra, duas medidas (recomendo)"
            note="O corte vem do nível (domínio) e não volta atrás; o brilho vem da semana: com menos de 4 dias estudados a pedra fica fosca, sem perder o corte. Uma linha em ouro para o domínio, outra azul para o ritmo."
          >
            <StoneCardA mastered={mastered} metDays={metDays} todayActions={12} />
          </Option>
          <Option
            label="B · Duas peças"
            note="A pedra da semana fica como está hoje (sobe e desce), e o nível vira um selo separado embaixo, com a linha em ouro. Mais fácil de explicar, mas são duas leituras para a mesma ideia de progresso."
          >
            <StoneCardB mastered={mastered} metDays={metDays} todayActions={12} />
          </Option>
        </div>
        <div className="mt-8 grid items-start gap-8 md:grid-cols-2">
          <Option
            label="Como a pedra evolui (A)"
            note="Os cinco cortes de hoje viram os primeiros níveis. Depois de Polida, cada nível acrescenta uma partícula de pirita: o ouro só aparece pelo que você domina."
          >
            <Ladder />
          </Option>
          <Option
            label="O brilho pela semana (A)"
            note="Mesmo nível, semanas diferentes: o corte fica; o brilho volta quando você volta a estudar. Nada se perde por um dia ou uma semana fora."
          >
            <ShineDemo />
          </Option>
        </div>
      </Section>

      <Section
        note="Aparece na conclusão da prática ou do quiz que fez o nível subir, nunca no meio da sessão. A pedra ganha o novo corte em pouco mais de um segundo; texto simples, uma ação, sem confete nem som. Com movimento reduzido, a pedra já aparece no novo corte."
        title="Subir de nível"
      >
        <ReplayButton onReplay={() => setRun(run + 1)} />
        <div className="mt-4 grid items-start gap-8 md:grid-cols-2">
          <Option
            label="A · No topo do resumo (recomendo)"
            note="O novo nível abre o próprio resumo da sessão, no mesmo cartão. Não exige um clique a mais para ver como foi."
          >
            <LevelUpInline run={run} />
          </Option>
          <Option
            label="B · Um momento próprio"
            note="Antes do resumo, a pedra maior e centralizada; “Ver resumo” segue para o resto. Mais cerimônia, um clique a mais."
          >
            <LevelUpMoment run={run} />
          </Option>
        </div>
      </Section>

      <Section
        note="Um bloco igual no fim de tudo que conta como estudo (prática de flashcards e quiz): a meta de hoje antes e depois da sessão, e o que passou a ser dominado até o próximo nível. Criar materiais não conta, para não premiar volume."
        title="O que a sessão somou"
      >
        <div className="grid items-start gap-8 md:grid-cols-2">
          <Option
            label="Fim da prática de flashcards"
            note="Abaixo da distribuição de como foi lembrar."
          >
            <SummaryShell>
              <div className="result-head">
                <div>
                  <h3 className="page-title">12 flashcards revisados</h3>
                  <p className="result-subtitle">10 lembrados · 2 ainda disponíveis</p>
                </div>
                <div className="practice-actions">
                  <Button variant="outline">Voltar à coleção</Button>
                  <Button>Praticar mais</Button>
                </div>
              </div>
              <Contribution after={18} before={6} newlyMastered={3} />
            </SummaryShell>
          </Option>
          <Option label="Fim do quiz" note="O mesmo bloco, com a meta cumprida nesta sessão.">
            <SummaryShell>
              <div className="result-head">
                <div>
                  <h3 className="page-title">5 de 6 corretas</h3>
                  <p className="result-subtitle">83% · melhor resultado até agora</p>
                </div>
                <div className="practice-actions">
                  <Button>Voltar ao quiz</Button>
                </div>
              </div>
              <Contribution after={24} before={18} newlyMastered={1} />
            </SummaryShell>
          </Option>
        </div>
      </Section>

      <Section
        note="Nas coleções, o que já é dominado ganha um segmento em ouro, à frente dos demais. É o mesmo ouro da pedra, com o mesmo significado."
        title="Ouro para o que é dominado"
      >
        <div className="grid items-start gap-8 md:grid-cols-2">
          <Option label="Hoje" note="Em dia, para revisar e novos.">
            <div className="surface-panel p-5">
              <StudyStrip
                emptyLabel=""
                label="Hoje"
                noun={{ singular: "flashcard", plural: "flashcards" }}
                segments={stripNow}
              />
            </div>
          </Option>
          <Option label="Com dominados" note="Os dominados saem de “em dia” e vêm primeiro.">
            <div className="surface-panel p-5">
              <StudyStrip
                emptyLabel=""
                label="Com dominados"
                noun={{ singular: "flashcard", plural: "flashcards" }}
                segments={stripGold}
              />
            </div>
          </Option>
        </div>
      </Section>

      <p className={cn("mt-14 max-w-3xl text-xs text-muted-foreground")}>
        Fica para depois desta aprovação: meta diária ajustável (tipo, quantidade ou tempo, com
        sugestões fácil, média e difícil) e a tela “Sua pedra”, com histórico e domínio por projeto.
      </p>
    </ContentPage>
  );
}
