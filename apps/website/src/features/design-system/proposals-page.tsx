import type { CSSProperties, ReactNode } from "react";

import { Facet } from "@/components/brand-mark.tsx";
import { CutGem } from "@/components/brand/cut-gem.tsx";
import { ContentPage } from "@/components/content-page.tsx";
import { ProjectClosedIcon } from "@/components/domain-icons.ts";
import { EmptyState } from "@/components/empty-state.tsx";
import {
  ChartBarIcon,
  ChevronDownIcon,
  GemIcon,
  HouseIcon,
  PlusIcon,
} from "@/components/icons.tsx";
import { Kbd } from "@/components/ui/kbd.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import "@/components/study-practice.css";

/*
 * Internal study page (development only): more places for the stone, each showing something real
 * (the level, the shine, an item just mastered). Mocks with the app's own pieces; nothing here
 * reaches the app.
 */

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
    <h2 className="text-base font-semibold">{title}</h2>
    <p className="mt-1 mb-5 max-w-3xl text-sm text-muted-foreground">{note}</p>
    {children}
  </section>
);

const Labelled = ({ children, label }: { children: ReactNode; label: string }) => (
  <div className="grid min-w-0 content-start gap-3">
    <p className="text-sm font-semibold">{label}</p>
    {children}
  </div>
);

const goldFacet = { "--facet-size": "0.5rem" } as CSSProperties;

/* 1 · Sidebar ---------------------------------------------------------------------------------- */

const NavMock = ({ stone }: { stone: boolean }) => (
  <div className="w-60 rounded-[var(--radius-panel)] bg-sidebar p-3">
    {[
      { label: "Início", icon: <HouseIcon aria-hidden="true" className="size-[18px]" /> },
      { label: "Estatísticas", icon: <ChartBarIcon aria-hidden="true" className="size-[18px]" /> },
      {
        label: "Sua pedra",
        icon: stone ? (
          <span className="grid size-[18px] place-items-center">
            <CutGem cut={0.62} dull={0.25} size={18} />
          </span>
        ) : (
          <GemIcon aria-hidden="true" className="size-[18px]" />
        ),
      },
    ].map((item) => (
      <div
        className="flex h-8 items-center gap-2.5 rounded-[var(--radius)] px-2 text-sm text-sidebar-foreground"
        key={item.label}
      >
        <span className="text-muted-foreground">{item.icon}</span>
        {item.label}
      </div>
    ))}
  </div>
);

/* 2 · Flashcard rating -------------------------------------------------------------------------- */

const ratings = [
  { value: "again", label: "Repetir", key: "1", interval: "1 min" },
  { value: "hard", label: "Difícil", key: "2", interval: "3 d" },
  { value: "good", label: "Bom", key: "3", interval: "12 d" },
  { value: "easy", label: "Fácil", key: "4", interval: "32 d" },
];

const RatingMock = ({ mastered }: { mastered: boolean }) => (
  <div className="surface-panel p-5">
    <div className="practice-scale">
      {ratings.map((rating) => {
        const masters = mastered && rating.value === "easy";
        return (
          <button
            className="practice-rating"
            data-rating={rating.value}
            key={rating.value}
            type="button"
          >
            <span className="practice-rating-label">
              {rating.label}
              <Kbd>{rating.key}</Kbd>
            </span>
            <span className="practice-rating-interval flex items-center gap-1.5">
              {rating.interval}
              {masters && (
                <span className="flex items-center gap-1 text-[var(--gold-ink)]">
                  <Facet state="active" style={{ ...goldFacet, color: "var(--gold)" }} />
                  dominado
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

/* 3 · Quiz review ------------------------------------------------------------------------------ */

const QuizRowMock = ({ mastered }: { mastered: boolean }) => (
  <div className="surface-panel p-5">
    {[
      { text: "Qual destas é uma prática de recuperação ativa?", correct: true, masters: true },
      { text: "Quem descreveu a curva do esquecimento?", correct: false, masters: false },
    ].map((row, index) => (
      <div
        className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto_1rem] items-start gap-3 py-2.5"
        key={row.text}
      >
        <span className="result-badge" data-outcome={row.correct ? "correct" : "incorrect"}>
          {index + 1}
        </span>
        <span className="result-row-text">{row.text}</span>
        <span
          className={cn(
            "flex items-center gap-1 pt-1 text-xs text-[var(--gold-ink)]",
            !(mastered && row.masters) && "invisible",
          )}
        >
          <Facet state="active" style={{ ...goldFacet, color: "var(--gold)" }} />
          dominada
        </span>
        <ChevronDownIcon aria-hidden="true" className="mt-1 size-4 text-muted-foreground" />
      </div>
    ))}
  </div>
);

/* 4 · Empty states ----------------------------------------------------------------------------- */

/** Its own box: the empty state's glyph slot is sized for a 24px icon. */
const RoughStone = () => (
  <span className="block size-12">
    <CutGem cut={0} size={48} />
  </span>
);

const EmptyMock = ({ stone }: { stone: boolean }) => (
  <EmptyState
    action={
      <Button>
        <PlusIcon aria-hidden="true" /> Novo projeto
      </Button>
    }
    description="Reúna documentos e materiais de um assunto em um projeto."
    icon={stone ? RoughStone : ProjectClosedIcon}
    iconClassName={stone ? "text-foreground" : undefined}
    minHeight="sm"
    title="Nenhum projeto ainda"
  />
);

/* Page ----------------------------------------------------------------------------------------- */

export default function ProposalsPage() {
  return (
    <ContentPage maxWidth="6xl">
      <h1 className="page-title">Propostas</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Mais lugares para a pedra, cada um mostrando algo real seu. Nada aqui está aplicado no app.
      </p>

      <Section
        note="O ícone de “Sua pedra” passa a ser a sua pedra: o corte do seu nível e o brilho da sua semana, em todas as telas."
        title="Menu lateral"
      >
        <div className="flex flex-wrap gap-10">
          <Labelled label="Hoje">
            <NavMock stone={false} />
          </Labelled>
          <Labelled label="Proposta">
            <NavMock stone />
          </Labelled>
        </div>
      </Section>

      <Section
        note="Quando uma resposta leva o flashcard a 21 dias ou mais pela primeira vez, a próxima revisão mostra que ele passa a ser dominado. É o momento em que o domínio acontece."
        title="Prática de flashcards"
      >
        <div className="grid max-w-2xl gap-8">
          <Labelled label="Hoje">
            <RatingMock mastered={false} />
          </Labelled>
          <Labelled label="Proposta">
            <RatingMock mastered />
          </Labelled>
        </div>
      </Section>

      <Section
        note="Na revisão do quiz, a questão acertada pela segunda vez, em outro dia, aparece como dominada."
        title="Revisão do quiz"
      >
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <Labelled label="Hoje">
            <QuizRowMock mastered={false} />
          </Labelled>
          <Labelled label="Proposta">
            <QuizRowMock mastered />
          </Labelled>
        </div>
      </Section>

      <Section
        note="Opcional, o mais próximo de enfeite: a pedra bruta no lugar do ícone dos estados vazios, como a matéria-prima esperando."
        title="Estados vazios"
      >
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <Labelled label="Hoje">
            <EmptyMock stone={false} />
          </Labelled>
          <Labelled label="Proposta">
            <EmptyMock stone />
          </Labelled>
        </div>
      </Section>
    </ContentPage>
  );
}
