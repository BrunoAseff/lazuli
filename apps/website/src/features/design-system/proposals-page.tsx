import type { ReactNode } from "react";

import { ContentPage } from "@/components/content-page.tsx";
import {
  DocumentDomainIcon,
  FlashcardDomainIcon,
  ProjectOpenIcon,
  QuizDomainIcon,
} from "@/components/domain-icons.ts";
import { CheckIcon, ChevronRightIcon, XIcon } from "@/components/icons.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";

/*
 * Internal study page (development only): a fuller example project and first steps that start
 * with something to practise. Mocks in the app's own styles; nothing here reaches the app.
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

/* First steps ---------------------------------------------------------------------------------- */

type Step = { title: string; description: string; action: string; done?: boolean };

const stepsToday: Step[] = [
  {
    title: "Adicione seu material",
    description: "Crie um projeto e escreva ou importe um documento próprio.",
    action: "Adicionar material",
  },
  { title: "Prepare a prática", description: "", action: "" },
  { title: "Revise antes de salvar", description: "", action: "" },
  { title: "Pratique e retorne", description: "", action: "" },
];

const stepsProposed: Step[] = [
  {
    title: "Pratique o exemplo",
    description: "Alguns minutos com os flashcards do projeto de exemplo.",
    action: "Praticar o exemplo",
  },
  {
    title: "Adicione seu material",
    description: "Escreva ou importe um documento seu.",
    action: "Adicionar material",
  },
  {
    title: "Crie materiais com IA",
    description: "Gere flashcards ou questões do seu documento e salve o que aprovar.",
    action: "Criar materiais",
  },
  {
    title: "Defina sua meta",
    description: "Quantas práticas por dia e em quais dias.",
    action: "Definir meta",
  },
];

const StepsCard = ({ current, steps }: { current: number; steps: Step[] }) => (
  <section className="surface-panel flex flex-col p-6">
    <header className="flex items-center justify-between gap-4">
      <h3 className="text-sm leading-snug font-semibold">Primeiros passos</h3>
      <Button aria-label="Ocultar orientação" size="icon" variant="ghost">
        <XIcon aria-hidden="true" />
      </Button>
    </header>
    <ol className="mt-6 grid gap-x-7 gap-y-5 sm:grid-cols-2">
      {steps.map((step, index) => {
        const here = index === current;
        const done = index < current;
        return (
          <li className="flex gap-3" key={step.title}>
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-muted-foreground shadow-[inset_0_0_0_1px_var(--input)]",
                done && "bg-success text-success-foreground shadow-none",
                here && "bg-action text-action-foreground shadow-none",
              )}
            >
              {done ? <CheckIcon aria-hidden="true" className="size-4" /> : index + 1}
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block font-medium">{step.title}</span>
              {here && step.description && (
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {step.description}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
    <div className="mt-auto flex justify-end pt-7">
      <Button>
        {steps[current]!.action}
        <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
      </Button>
    </div>
  </section>
);

/* Example project ------------------------------------------------------------------------------ */

const documents = [
  {
    title: "Recuperação ativa",
    outline: ["O que é", "O efeito do teste", "Como praticar"],
    flashcards: 4,
    questions: 2,
  },
  {
    title: "Repetição espaçada",
    outline: ["A curva do esquecimento", "Intervalos que crescem", "Como o Lazúli agenda"],
    flashcards: 4,
    questions: 2,
  },
  {
    title: "Intercalar e elaborar",
    outline: ["Misturar assuntos", "Perguntar por quê", "Um plano de estudo"],
    flashcards: 4,
    questions: 2,
  },
];

const ExampleProject = () => (
  <section className="surface-panel grid gap-6 p-6 sm:p-8">
    <div className="flex items-center gap-2.5">
      <ProjectOpenIcon aria-hidden="true" className="text-muted-foreground" />
      <h3 className="text-sm font-semibold">Exemplo: aprendendo a aprender</h3>
    </div>
    <ul className="grid gap-x-10 gap-y-6 md:grid-cols-3">
      {documents.map((doc) => (
        <li className="grid content-start gap-3" key={doc.title}>
          <span className="flex items-center gap-2 text-sm font-medium">
            <DocumentDomainIcon aria-hidden="true" className="size-4 text-muted-foreground" />
            {doc.title}
          </span>
          <ul className="grid gap-1 text-xs text-muted-foreground">
            {doc.outline.map((heading) => (
              <li key={heading}>{heading}</li>
            ))}
          </ul>
          <span className="text-xs text-muted-foreground tabular-nums">
            {doc.flashcards} flashcards · {doc.questions} questões
          </span>
        </li>
      ))}
    </ul>
    <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
      <span className="flex items-center gap-2">
        <FlashcardDomainIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        Memória e aprendizagem · 12 flashcards
      </span>
      <span className="flex items-center gap-2">
        <QuizDomainIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        Memória e aprendizagem · 6 questões
      </span>
    </div>
  </section>
);

/* Page ----------------------------------------------------------------------------------------- */

export default function ProposalsPage() {
  return (
    <ContentPage maxWidth="6xl">
      <h1 className="page-title">Propostas</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Projeto de exemplo e primeiros passos, para aprovação. Nada aqui está aplicado no app.
      </p>

      <Section
        note="Começar praticando algo pronto, antes de pedir um documento. Gerar e revisar viram um passo só, como no app hoje. O exemplo passa a aparecer no Início para quem ainda não tem material próprio."
        title="Primeiros passos"
      >
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <Labelled label="Hoje">
            <StepsCard current={0} steps={stepsToday} />
          </Labelled>
          <Labelled label="Proposta">
            <StepsCard current={0} steps={stepsProposed} />
          </Labelled>
        </div>
      </Section>

      <Section
        note="Hoje: um documento curto, 2 flashcards e 2 questões. Proposta: três documentos curtos sobre como estudar, com títulos, listas e trechos ligados aos materiais, para a prática durar alguns minutos e mostrar o app inteiro: documentos, fontes, prática, quiz e a pedra."
        title="Projeto de exemplo"
      >
        <ExampleProject />
      </Section>

      <Section
        note="Para depois: no cadastro, escolher a área (ENEM, Medicina, Direito, Concursos, Idiomas) e receber um exemplo dela. Exige escrever e revisar o conteúdo de cada área; não entra agora."
        title="Exemplos por área"
      >
        <div />
      </Section>
    </ContentPage>
  );
}
