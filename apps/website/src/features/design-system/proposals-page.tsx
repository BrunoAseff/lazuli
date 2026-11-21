import { motion, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";

import { ContentPage } from "@/components/content-page.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { MaterialsDemo, StoneDemo } from "@/features/landing/landing-demos.tsx";
import { cn } from "@/lib/utils.ts";

/*
 * Internal study page (development only): how a chapter of the public page enters, for approval.
 * Each option moves the text and the demo as one piece, and none of them rises from below.
 */

type Variant = "corte" | "reflexo" | "faceta";

const options: Array<{ id: Variant; name: string; idea: string; steps: string[] }> = [
  {
    id: "corte",
    name: "A · Corte",
    idea: "Um golpe de cinzel: um corte diagonal atravessa o capítulo e o revela inteiro.",
    steps: [
      "O capítulo (texto e demonstração juntos) aparece atrás de uma aresta inclinada.",
      "A aresta varre da esquerda para a direita, como uma lâmina passando na pedra.",
      "Nada se desloca: só a área visível cresce.",
    ],
  },
  {
    id: "reflexo",
    name: "B · Reflexo",
    idea: "A luz passa pela pedra: tudo surge no lugar, e um reflexo cruza a demonstração.",
    steps: [
      "Título, texto e demonstração acendem no lugar, nessa ordem, sem deslocamento.",
      "Um reflexo diagonal atravessa a demonstração uma vez, como luz numa faceta.",
      "O reflexo some ao terminar; depois disso a página fica quieta.",
    ],
  },
  {
    id: "faceta",
    name: "C · Faceta",
    idea: "Duas faces da mesma pedra giram para a luz e se encontram no meio.",
    steps: [
      "Texto e demonstração começam levemente girados, cada um para o seu lado.",
      "Os dois giram juntos até ficarem de frente, encontrando-se no centro.",
      "Um movimento lateral e em profundidade, nunca de baixo para cima.",
    ],
  },
];

const settle = { type: "spring", stiffness: 140, damping: 22, mass: 1 } as const;

const ChapterText = ({ lead, title }: { lead: string; title: string }) => (
  <>
    <h2 className="font-reading text-3xl leading-tight font-medium text-balance sm:text-4xl">
      {title}
    </h2>
    <p className="mt-3 max-w-md text-lg leading-relaxed text-muted-foreground">{lead}</p>
  </>
);

/** One chapter of the public page, entering as the chosen option. */
const ChapterPreview = ({
  demo,
  flip = false,
  lead,
  title,
  variant,
}: {
  demo: ReactNode;
  flip?: boolean;
  lead: string;
  title: string;
  variant: Variant;
}) => {
  const reduced = useReducedMotion();
  const grid = cn(
    "grid items-center gap-10 lg:gap-16",
    flip
      ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
      : "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]",
  );
  const textOrder = flip ? "lg:order-2" : undefined;
  const demoOrder = flip ? "lg:order-1" : undefined;

  if (reduced)
    return (
      <div className={grid}>
        <div className={textOrder}>
          <ChapterText lead={lead} title={title} />
        </div>
        <div className={demoOrder}>{demo}</div>
      </div>
    );

  if (variant === "corte")
    return (
      <motion.div
        animate={{ clipPath: "polygon(0% 0%, 130% 0%, 100% 100%, -30% 100%)" }}
        className={grid}
        initial={{ clipPath: "polygon(0% 0%, 0% 0%, -30% 100%, -30% 100%)" }}
        transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
      >
        <div className={textOrder}>
          <ChapterText lead={lead} title={title} />
        </div>
        <div className={demoOrder}>{demo}</div>
      </motion.div>
    );

  if (variant === "reflexo")
    return (
      <div className={grid}>
        <div className={textOrder}>
          <motion.div
            animate={{ opacity: 1 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <ChapterText lead={lead} title={title} />
          </motion.div>
        </div>
        <motion.div
          animate={{ opacity: 1 }}
          className={cn("relative isolate", demoOrder)}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          {demo}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[var(--radius-panel)]"
          >
            <motion.span
              animate={{ x: "320%" }}
              className="absolute inset-y-[-20%] left-0 w-1/3 -skew-x-12 bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.55),transparent)] mix-blend-soft-light dark:bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.18),transparent)] dark:mix-blend-screen"
              initial={{ x: "-120%" }}
              transition={{ duration: 1.1, delay: 0.45, ease: [0.4, 0, 0.2, 1] }}
            />
          </span>
        </motion.div>
      </div>
    );

  // Faceta: the two faces turn toward each other around the line between them.
  const side = flip ? -1 : 1;
  return (
    <div className={cn(grid, "[perspective:1400px]")}>
      <motion.div
        animate={{ opacity: 1, rotateY: 0 }}
        className={textOrder}
        initial={{ opacity: 0, rotateY: 14 * side }}
        style={{ transformOrigin: flip ? "left center" : "right center" }}
        transition={settle}
      >
        <ChapterText lead={lead} title={title} />
      </motion.div>
      <motion.div
        animate={{ opacity: 1, rotateY: 0 }}
        className={demoOrder}
        initial={{ opacity: 0, rotateY: -10 * side }}
        style={{ transformOrigin: flip ? "right center" : "left center" }}
        transition={{ ...settle, delay: 0.06 }}
      >
        {demo}
      </motion.div>
    </div>
  );
};

export default function ProposalsPage() {
  const [variant, setVariant] = useState<Variant>("corte");
  const [run, setRun] = useState(0);
  const [flip, setFlip] = useState(false);
  const current = options.find((option) => option.id === variant)!;
  return (
    <ContentPage maxWidth="6xl">
      <h1 className="page-title">Propostas</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Como cada capítulo da página pública entra na tela. Hoje a demonstração sobe sozinha e o
        texto fica parado; aqui os dois entram como uma peça só. Nada aqui está aplicado.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {options.map((option) => (
          <Button
            key={option.id}
            onClick={() => {
              setVariant(option.id);
              setRun((value) => value + 1);
            }}
            variant={option.id === variant ? "default" : "outline"}
          >
            {option.name}
          </Button>
        ))}
        <Button onClick={() => setRun((value) => value + 1)} variant="field-link">
          Ver de novo
        </Button>
        <label className="ml-auto flex items-center gap-3 text-sm">
          <Switch checked={flip} onCheckedChange={setFlip} />
          Demonstração à esquerda
        </label>
      </div>

      <section className="mt-6 grid gap-2 text-[0.8125rem] text-muted-foreground">
        <p className="text-sm text-foreground">{current.idea}</p>
        <ol className="grid gap-1">
          {current.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <div className="mt-10 rounded-[var(--radius-overlay)] bg-background p-6 ring-1 ring-border/50 sm:p-10">
        <ChapterPreview
          demo={flip ? <StoneDemo /> : <MaterialsDemo />}
          flip={flip}
          key={`${variant}-${run}-${flip}`}
          lead={
            flip
              ? "Cada resposta agenda a próxima revisão, e a pedra mostra o seu ritmo."
              : "PDF, DOCX, Markdown ou TXT, organizados por matéria."
          }
          title={flip ? "Revise no dia certo" : "Importe seus materiais de estudo"}
          variant={variant}
        />
      </div>
    </ContentPage>
  );
}
