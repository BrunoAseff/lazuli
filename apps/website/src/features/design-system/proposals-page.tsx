import type { CSSProperties, ReactNode } from "react";

import { Facet } from "@/components/brand-mark.tsx";
import { ContentPage } from "@/components/content-page.tsx";
import { CheckIcon } from "@/components/icons.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";

/*
 * Internal study page (development only): visual decisions wait here for approval before they
 * reach the app. Each approved proposal is applied and then removed from this page.
 */

const steps = [
  { title: "Pratique o exemplo", state: "done" },
  { title: "Adicione seu material", state: "current" },
  { title: "Crie materiais com IA", state: "todo" },
  { title: "Defina sua meta", state: "todo" },
] as const;

type StepState = (typeof steps)[number]["state"];

const Option = ({
  children,
  label,
  note,
}: {
  children: ReactNode;
  label: string;
  note: string;
}) => (
  <div className="grid content-start gap-3">
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{note}</p>
    </div>
    {children}
  </div>
);

const StepList = ({ marker }: { marker: (state: StepState, index: number) => ReactNode }) => (
  <ol className="surface-panel grid gap-4 p-5">
    {steps.map((step, index) => (
      <li className="flex items-center gap-3" key={step.title}>
        {marker(step.state, index)}
        <span className={cn("font-medium", step.state === "todo" && "text-muted-foreground")}>
          {step.title}
        </span>
      </li>
    ))}
  </ol>
);

/** Today's markers: numbered circles, the done one in green. */
const currentMarker = (state: StepState, index: number) => (
  <span
    className={cn(
      "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-muted-foreground shadow-[inset_0_0_0_1px_var(--input)]",
      state === "done" && "bg-success text-success-foreground shadow-none",
      state === "current" && "bg-action text-action-foreground shadow-none",
    )}
  >
    {state === "done" ? <CheckIcon className="size-4" /> : index + 1}
  </span>
);

/** A: the stone's facet, as in the week of "Sua pedra": filled when done, larger for the current. */
const facetMarker = (state: StepState) => (
  <span className="grid size-7 shrink-0 place-items-center">
    <Facet
      className={state === "current" ? "scale-[2]" : "scale-150"}
      state={state === "todo" ? "idle" : "active"}
    />
  </span>
);

/** B: the same circles, in lapis only (no green): done is an outlined check. */
const lapisMarker = (state: StepState, index: number) => (
  <span
    className={cn(
      "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-muted-foreground shadow-[inset_0_0_0_1px_var(--input)]",
      state === "done" && "text-primary shadow-[inset_0_0_0_1.5px_var(--primary)]",
      state === "current" && "bg-action text-action-foreground shadow-none",
    )}
  >
    {state === "done" ? <CheckIcon className="size-4" /> : index + 1}
  </span>
);

/** The night palette with neutral grays instead of the blue-tinted ones. */
const neutralNight = {
  "--background": "#131315",
  "--card": "#1b1b1e",
  "--popover": "#212124",
  "--muted": "#26262a",
  "--secondary": "#26262a",
  "--accent": "#2b2b30",
  "--sidebar": "#0f0f11",
  "--border": "rgb(255 255 255 / 9%)",
  "--input": "rgb(255 255 255 / 18%)",
  "--line-subtle": "rgb(255 255 255 / 6%)",
} as CSSProperties;

const NightPreview = ({ style }: { style?: CSSProperties }) => (
  <div
    className="dark rounded-[var(--radius-panel)] bg-background p-5 text-foreground"
    style={style}
  >
    <div className="surface-panel grid gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Seu próximo estudo</p>
        <span className="text-[0.8125rem] text-muted-foreground">Ver coleções</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.9375rem] font-medium">Memória e aprendizagem</p>
          <p className="text-xs text-muted-foreground">1 flashcard para revisar</p>
        </div>
        <Button size="sm">Praticar</Button>
      </div>
      <div className="rounded-[var(--radius)] border border-input px-3 py-2 text-sm text-muted-foreground">
        Pesquisar coleções
      </div>
    </div>
  </div>
);

export default function ProposalsPage() {
  return (
    <ContentPage maxWidth="6xl">
      <h1 className="page-title">Propostas</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Duas decisões visuais da vistoria, para aprovação. Nada aqui está aplicado.
      </p>

      <section className="mt-8 grid gap-4">
        <h2 className="text-sm font-semibold">1. Marcador dos passos do início</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <Option label="Hoje" note="Círculos numerados; o passo feito em verde.">
            <StepList marker={currentMarker} />
          </Option>
          <Option
            label="A · Faceta"
            note="A faceta da pedra, como na semana de “Sua pedra”; o passo atual um pouco maior."
          >
            <StepList marker={(state) => facetMarker(state)} />
          </Option>
          <Option label="B · Círculo em lápis" note="Os mesmos círculos, só em lápis, sem verde.">
            <StepList marker={lapisMarker} />
          </Option>
        </div>
      </section>

      <section className="mt-12 grid gap-4">
        <h2 className="text-sm font-semibold">2. Tema escuro</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Option label="Hoje" note="Fundo, superfícies e bordas com um tom de azul.">
            <NightPreview />
          </Option>
          <Option
            label="A · Neutro"
            note="Cinzas neutros; o azul fica só nas ações, marcadores e na pedra."
          >
            <NightPreview style={neutralNight} />
          </Option>
        </div>
      </section>
    </ContentPage>
  );
}
