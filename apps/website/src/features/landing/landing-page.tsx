import { motion, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";

import { AutoHeight } from "@/components/auto-height.tsx";
import { LapisField } from "@/components/brand/lapis-field.tsx";
import { LazuliWordmark } from "@/components/brand-mark.tsx";
import { ArrowRightIcon, MinusIcon, PlusIcon } from "@/components/icons.tsx";
import { LegalLinks } from "@/features/legal/legal-links.tsx";
import { spring } from "@/lib/motion.ts";
import { cn } from "@/lib/utils.ts";

import { resetAccountEntryScroll } from "./account-navigation.ts";
import { landingQuestions } from "./landing-faq.ts";
import { GenerationDemo, MaterialsDemo, PracticeDemo, StoneDemo } from "./landing-demos.tsx";
import "./landing.css";

/**
 * The public page, built from the app's own parts: the stone as the one spectacular material,
 * then the product itself, at editorial scale. Every demo below is the real component.
 */
export default function LandingPage() {
  return (
    <div className="landing min-h-svh bg-background text-foreground">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-[var(--radius)] focus:bg-card focus:px-4 focus:py-2"
        href="#conteudo"
      >
        Pular para o conteúdo
      </a>
      <Hero />
      <main className="mx-auto max-w-6xl space-y-32 px-5 pt-40 pb-32 sm:px-8" id="conteudo">
        <Chapter
          demo={<MaterialsDemo />}
          id="materiais"
          lead="PDF, DOCX, Markdown ou TXT, organizados por matéria."
          title="Importe seus materiais de estudo"
        />
        <Chapter
          demo={<GenerationDemo />}
          flip
          id="ia"
          lead="Você revisa as sugestões e salva só o que aprovar."
          title="Crie flashcards com IA"
        />
        <Chapter
          demo={<PracticeDemo />}
          id="pratica"
          lead="Experimente aqui, é a mesma prática do app."
          title="Pratique com flashcards e quizzes"
        />
        <Chapter
          demo={<StoneDemo />}
          flip
          id="ritmo"
          lead="Cada resposta agenda a próxima revisão, e a pedra mostra o seu ritmo."
          title="Revise no dia certo"
        />
        <Faq />
      </main>
      <Closing />
    </div>
  );
}

const Hero = () => (
  <header className="relative isolate flow-root">
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <LapisField className="size-full" />
    </div>
    <nav
      aria-label="Principal"
      className="on-stone mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8"
    >
      <LazuliWordmark className="lz-on-lapis text-2xl" />
      <div className="flex items-center gap-6">
        <Link className="stone-link" data-size="sm" onClick={resetAccountEntryScroll} to="/login">
          Entrar
        </Link>
        <Link
          className="stone-action"
          data-size="sm"
          onClick={resetAccountEntryScroll}
          to="/register"
        >
          Criar conta grátis
        </Link>
      </div>
    </nav>
    <div className="mx-auto max-w-6xl px-5 pt-16 sm:px-8 sm:pt-24">
      <div className="on-stone">
        <h1 className="max-w-3xl font-reading text-5xl leading-[1.04] font-medium text-balance sm:text-7xl">
          Lapide o que você estuda
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
          Importe seus PDFs e anotações, a IA cria flashcards e quizzes, e você revisa cada assunto
          no dia certo.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link className="stone-action" onClick={resetAccountEntryScroll} to="/register">
            Criar conta grátis
          </Link>
          <a className="stone-link" href="#materiais">
            Ver como funciona <ArrowRightIcon aria-hidden="true" />
          </a>
        </div>
      </div>
      {/* The product itself rises out of the stone and overlaps the page below. */}
      <div className="relative mt-16 -mb-28 sm:mt-20">
        <ProductPreview />
      </div>
    </div>
  </header>
);

/** A home screen with example data, built from the same pieces as the app's own. */
const ProductPreview = () => (
  <div
    aria-label="Prévia da página inicial do Lazúli"
    // A picture of the app: nothing inside it takes focus or clicks.
    inert
    className="overflow-hidden rounded-[var(--radius-overlay)] border border-white/15 bg-background text-foreground shadow-[0_24px_80px_rgb(8_12_40/0.35)]"
    role="img"
  >
    <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,7fr)_minmax(16rem,4fr)]">
      <div className="grid content-start gap-5">
        <p className="page-title">Boa tarde, Ana</p>
        <div className="surface-panel flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-semibold">Seu próximo estudo</p>
            <p className="mt-3 text-xl">Física: luz e cor</p>
            <p className="text-xs text-muted-foreground">8 flashcards para revisar</p>
          </div>
          <span className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] bg-action px-3 text-sm text-action-foreground">
            Revisar <ArrowRightIcon className="size-4" />
          </span>
        </div>
        <div className="hidden gap-1 sm:grid">
          <p className="mb-1 text-sm font-semibold">Documentos recentes</p>
          {["Por que o céu é azul?", "A luz no pôr do sol", "Óptica: resumo da aula"].map(
            (title, index) => (
              <p key={title} className="flex justify-between gap-3 px-1 py-2 text-sm">
                <span>{title}</span>
                <span className="text-xs text-muted-foreground">{index ? "ontem" : "hoje"}</span>
              </p>
            ),
          )}
        </div>
      </div>
      <div className="hidden content-start gap-4 lg:grid">
        <StoneDemo />
        <div className="surface-panel p-5">
          <p className="text-sm font-semibold">Ritmo de estudo</p>
          <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
          {/* Example week: flashcard reviews (lapis) under quiz answers (teal). */}
          <div className="mt-4 flex h-20 items-end gap-2">
            {[
              [10, 14],
              [0, 0],
              [12, 9],
              [18, 12],
              [6, 2],
              [14, 8],
              [8, 4],
            ].map(([cards, quiz], index) => (
              <div key={index} className="flex flex-1 flex-col justify-end gap-px">
                <span
                  className="rounded-t-[3px] bg-[var(--chart-3)]"
                  style={{ height: `${quiz! * 2.4}px` }}
                />
                <span
                  className="rounded-b-[3px] bg-primary"
                  style={{ height: `${Math.max(cards! * 2.4, 2)}px` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const Chapter = ({
  demo,
  flip = false,
  id,
  lead,
  title,
}: {
  demo: ReactNode;
  flip?: boolean;
  id: string;
  lead: string;
  title: string;
}) => {
  const reduced = useReducedMotion();
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn(
        "grid scroll-mt-24 items-center gap-10 lg:gap-16",
        // The demo always gets the wide column, whichever side it is on.
        flip
          ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
          : "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]",
      )}
      id={id}
    >
      <div className={flip ? "lg:order-2" : undefined}>
        <h2
          className="font-reading text-3xl leading-tight font-medium text-balance sm:text-4xl"
          id={`${id}-title`}
        >
          {title}
        </h2>
        <p className="mt-3 max-w-md text-lg leading-relaxed text-muted-foreground">{lead}</p>
      </div>
      <motion.div
        className={flip ? "lg:order-1" : undefined}
        initial={reduced ? false : { opacity: 0, y: 20 }}
        transition={spring.settle}
        viewport={{ once: true, margin: "-15% 0px" }}
        whileInView={{ opacity: 1, y: 0 }}
      >
        {demo}
      </motion.div>
    </section>
  );
};

const Faq = () => {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section
      aria-labelledby="faq-title"
      className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16"
    >
      <h2 className="font-reading text-3xl leading-tight font-medium sm:text-4xl" id="faq-title">
        Dúvidas frequentes
      </h2>
      <div className="divide-y divide-[var(--line-subtle)] border-y border-[var(--line-subtle)]">
        {landingQuestions.map(([question, answer], index) => {
          const expanded = open === index;
          return (
            <div key={question}>
              <h3>
                <button
                  aria-controls={`faq-${index}`}
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left text-lg font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  onClick={() => setOpen(expanded ? null : index)}
                  type="button"
                >
                  {question}
                  {expanded ? (
                    <MinusIcon
                      aria-hidden="true"
                      className="size-5 shrink-0 text-muted-foreground"
                    />
                  ) : (
                    <PlusIcon
                      aria-hidden="true"
                      className="size-5 shrink-0 text-muted-foreground"
                    />
                  )}
                </button>
              </h3>
              <AutoHeight>
                {expanded && (
                  <p
                    className="max-w-xl pb-6 leading-relaxed text-muted-foreground"
                    id={`faq-${index}`}
                  >
                    {answer}
                  </p>
                )}
              </AutoHeight>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const Closing = () => (
  <footer className="on-stone relative isolate overflow-hidden">
    <LapisField className="absolute inset-0 -z-10" />
    <div className="mx-auto max-w-6xl px-5 pt-24 pb-10 sm:px-8">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link className="stone-action" onClick={resetAccountEntryScroll} to="/register">
          Criar conta grátis
        </Link>
        <Link className="stone-link" onClick={resetAccountEntryScroll} to="/login">
          Já tenho uma conta <ArrowRightIcon aria-hidden="true" />
        </Link>
      </div>
      <LazuliWordmark
        aria-hidden="true"
        className="lz-on-lapis mt-24 text-[clamp(4.5rem,15vw,12rem)] leading-none text-white"
        mark={false}
      />
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
        <LegalLinks className="justify-start text-current" />
        <span>© {new Date().getFullYear()} Lazúli</span>
      </div>
    </div>
  </footer>
);
