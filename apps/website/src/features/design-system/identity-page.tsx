import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { motion, useReducedMotion } from "motion/react";

import { Facet, GemLoader, GemMark, LazuliWordmark } from "@/components/brand-mark.tsx";
import { LapisField } from "@/components/brand/lapis-field.tsx";
import { CutGem, gemStage } from "@/components/brand/cut-gem.tsx";
import { ChevronRightIcon, FileText } from "@/components/icons.tsx";
import { primaryNavigation } from "@/components/primary-navigation.ts";
import { Button } from "@/components/ui/button.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { goldBurst } from "@/components/motion/gold-burst.ts";
import { MorphText } from "@/components/motion/morph-text.tsx";
import { GenerationPending } from "@/features/ai/components/generation-pending.tsx";
import { spring } from "@/lib/motion.ts";
import { cn } from "@/lib/utils.ts";

type Theme = "light" | "dark";

const small = { "--facet-size": "0.4rem" } as CSSProperties;
/** Filled action, staged: in the night theme the fill keeps the pigment instead of going pastel. */
const action = "bg-[var(--action)] text-[var(--action-foreground)] hover:bg-[var(--action-hover)]";

/**
 * Development-only staging of the Lazúli identity ("lapidação"). Everything here is scoped under
 * [data-identity]; nothing reaches the product until it is approved and promoted to tokens.css.
 */
export default function IdentityPage() {
  const [theme, setTheme] = useState<Theme>("light");
  return (
    <div data-identity={theme} className="min-h-svh font-sans">
      <Hero theme={theme} onTheme={setTheme} />
      <div className="mx-auto max-w-6xl space-y-28 px-5 py-24 sm:px-8">
        <Concept />
        <Marks />
        <Palette />
        <Typography />
        <FacetSystem />
        <StoneStages />
        <Motion />
        <Preview />
      </div>
    </div>
  );
}

const Section = ({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead: string;
  children: ReactNode;
}) => (
  <section aria-labelledby={id} className="space-y-10">
    <header className="max-w-2xl space-y-3">
      <h2 id={id} className="font-reading text-4xl leading-tight font-medium sm:text-5xl">
        {title}
      </h2>
      <p className="text-base leading-relaxed text-muted-foreground">{lead}</p>
    </header>
    {children}
  </section>
);

/** Light and night side by side, each in its own scope. */
const BothThemes = ({
  className,
  children,
}: {
  className?: string;
  children: (theme: Theme) => ReactNode;
}) => (
  <div className="grid gap-5 lg:grid-cols-2">
    {(["light", "dark"] as const).map((theme) => (
      <div
        key={theme}
        data-identity={theme}
        className={cn("rounded-[var(--radius-panel)] border border-border", className)}
      >
        {children(theme)}
      </div>
    ))}
  </div>
);

const Hero = ({ theme, onTheme }: { theme: Theme; onTheme: (theme: Theme) => void }) => {
  return (
    <header className="relative isolate overflow-hidden text-white">
      <LapisField className="absolute inset-0 -z-10" />
      <div className="mx-auto flex min-h-[82svh] max-w-6xl flex-col px-5 py-6 sm:px-8">
        <nav className="flex items-center justify-between gap-4" aria-label="Bancada">
          <LazuliWordmark className="lz-on-lapis text-2xl" />
          <div className="flex items-center gap-3">
            <Link to="/system" className="text-sm text-white/80 hover:text-white">
              Componentes
            </Link>
            <div
              className="flex rounded-full bg-[rgb(5_8_30/0.45)] p-1"
              role="group"
              aria-label="Tema da página"
            >
              {(["light", "dark"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={theme === option}
                  onClick={() => onTheme(option)}
                  className="relative rounded-full px-3 py-1 text-sm"
                >
                  {theme === option && (
                    <motion.span
                      layoutId="identity-theme"
                      transition={spring.morph}
                      className="absolute inset-0 rounded-full bg-white"
                    />
                  )}
                  <span className={cn("relative", theme === option && "text-[var(--lapis-deep)]")}>
                    {option === "light" ? "Claro" : "Noite"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </nav>
        <div className="mt-auto grid gap-12 pb-12 lg:items-end">
          <div className="max-w-2xl">
            <h1 className="font-reading text-5xl leading-[1.02] font-medium text-balance sm:text-7xl">
              Lapide o que você estuda.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/90">
              Lápis-lazúli é a pedra que vira ultramarino, o pigmento mais caro do Renascimento. O
              Lazúli faz o mesmo com seus materiais: da pedra bruta ao que você domina.
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};

const materials = [
  {
    swatch: "bg-[var(--lapis-main)]",
    name: "Ultramarino",
    role: "A cor de ação e de marca. Botões, links, item ativo, foco.",
  },
  {
    swatch: "bg-[var(--pyrite)]",
    name: "Pirita",
    role: "O ouro, sempre escasso: só o que você domina, conclui ou conquista. Nunca decoração.",
  },
  {
    swatch: "bg-[var(--lapis-night)]",
    name: "Lápis noturno",
    role: "A pedra no escuro. O modo noite é a própria pedra, não uma inversão de cores.",
  },
];

const journey = [
  ["Pedra bruta", "Seus materiais: PDFs, anotações, resumos"],
  ["Lapidação", "A IA extrai perguntas, você revisa"],
  ["Pigmento aplicado", "Prática com flashcards e quizzes"],
  ["Ouro", "O que você já domina"],
];

const Concept = () => (
  <Section
    id="concept"
    title="Lapidação"
    lead="O caminho da pedra é o caminho do estudo. A identidade aparece na forma, na cor e no movimento; os textos da interface continuam literais."
  >
    <div className="grid gap-x-16 gap-y-12 lg:grid-cols-2">
      <dl className="space-y-7">
        {materials.map((item) => (
          <div key={item.name} className="grid grid-cols-[2rem_1fr] gap-x-4">
            <span className={cn("mt-1.5 size-4 rotate-45 rounded-[2px]", item.swatch)} />
            <dt className="font-reading text-2xl">{item.name}</dt>
            <dd className="col-start-2 mt-1 text-sm leading-relaxed text-muted-foreground">
              {item.role}
            </dd>
          </div>
        ))}
      </dl>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border text-sm text-muted-foreground">
            <th className="pb-3 font-normal">Na pedra</th>
            <th className="pb-3 font-normal">No Lazúli</th>
          </tr>
        </thead>
        <tbody>
          {journey.map(([stone, product]) => (
            <tr key={stone} className="border-b border-[var(--line-subtle)] last:border-0">
              <td className="py-4 pr-6 font-reading text-xl">{stone}</td>
              <td className="py-4 text-sm text-muted-foreground">{product}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Section>
);

const Marks = () => (
  <Section
    id="marks"
    title="A gema e o acento"
    lead="Uma lápis lapidada vista de cima: a mesa e quatro facetas iluminadas do alto à esquerda, com um ponto de pirita. No nome, o acento do ú é uma faceta de ouro."
  >
    <BothThemes className="space-y-10 bg-background p-6 sm:p-10">
      {() => (
        <>
          <div className="flex flex-wrap items-end gap-x-7 gap-y-4">
            {[16, 24, 32, 48, 96].map((size) => (
              <div key={size} className="flex flex-col items-center gap-2">
                <GemMark size={size} />
                <span className="text-xs text-muted-foreground tabular-nums">{size}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-start gap-5">
            <LazuliWordmark className="text-6xl" mark={false} />
            <LazuliWordmark className="text-2xl" />
            <LazuliWordmark className="text-lg" />
          </div>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <span className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
              <GemLoader />
              Verificando sua sessão…
            </span>
            <span className="flex items-center gap-2 rounded-t-lg border border-b-0 border-border bg-card px-3 py-2 text-xs">
              <GemMark size={16} />
              Lazúli — organize seus estudos
            </span>
          </div>
        </>
      )}
    </BothThemes>
  </Section>
);

const swatches: Record<Theme, Array<[string, string, string]>> = {
  light: [
    ["--background", "Fundo", ""],
    ["--card", "Cartões", ""],
    ["--foreground", "Texto", "15,8:1"],
    ["--muted-foreground", "Texto secundário", "5,8:1"],
    ["--primary", "Ultramarino", "7,7:1"],
    ["--primary-soft", "Seleção", ""],
    ["--gold", "Pirita", "só ícones"],
    ["--gold-ink", "Pirita em texto", "5,5:1"],
  ],
  dark: [
    ["--background", "Fundo", ""],
    ["--card", "Cartões", ""],
    ["--foreground", "Texto", "14,9:1"],
    ["--muted-foreground", "Texto secundário", "6,3:1"],
    ["--primary", "Ultramarino claro", "8,6:1"],
    ["--action", "Botão", "5,9:1"],
    ["--gold", "Pirita", ""],
    ["--gold-ink", "Pirita em texto", "9,2:1"],
  ],
};

const Palette = () => (
  <Section
    id="palette"
    title="Ultramarino de verdade"
    lead="O azul deixa de ser acinzentado e vira pigmento, sobre um papel frio e limpo. À noite, o botão mantém o pigmento em vez de virar pastel. Contraste medido contra o fundo de cada uso."
  >
    <BothThemes className="grid grid-cols-2 gap-x-4 gap-y-6 bg-background p-6 sm:grid-cols-4">
      {(theme) =>
        swatches[theme].map(([token, name, ratio]) => (
          <div key={token} className="space-y-2.5">
            <div
              className="h-14 rounded-[var(--radius)] border border-border"
              style={{ background: `var(${token})` }}
            />
            <div>
              <p className="text-sm font-medium">{name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{ratio || " "}</p>
            </div>
          </div>
        ))
      }
    </BothThemes>
  </Section>
);

const Typography = () => (
  <Section
    id="type"
    title="Newsreader para o que se lê"
    lead="Newsreader no conteúdo e nos momentos: título da página, frente do flashcard, enunciado, saudação. Manrope em tudo que é interface: rótulos, botões, menus, tabelas."
  >
    <BothThemes className="bg-background p-6 sm:p-10">
      {() => (
        <div className="space-y-8">
          <div>
            <h3 className="font-reading text-4xl leading-tight font-medium">
              Memória e aprendizagem
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">24 flashcards · atualizado hoje</p>
          </div>
          <div className="rounded-[var(--radius-panel)] border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">Pergunta</p>
            <p className="mt-2 font-reading text-2xl leading-snug">
              Por que a luz azul se espalha mais do que a vermelha?
            </p>
            <div className="mt-6 flex gap-2">
              <Button className={action}>Mostrar resposta</Button>
              <Button variant="ghost">Pular</Button>
            </div>
          </div>
        </div>
      )}
    </BothThemes>
  </Section>
);

const FacetSystem = () => {
  const [selected, setSelected] = useState(1);
  const [nav, setNav] = useState<string>("Flashcards");
  return (
    <Section
      id="facets"
      title="O losango marca o estado"
      lead="Um único sinal para item ativo, opção escolhida, revisão pendente, progresso e domínio. Sempre ao lado de texto: ele reforça, não explica sozinho."
    >
      <div className="grid gap-x-10 gap-y-12 lg:grid-cols-[14rem_1fr_16rem]">
        <nav aria-label="Exemplo de navegação" className="space-y-0.5">
          {primaryNavigation.slice(0, 4).map(({ Icon, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => setNav(label)}
              aria-current={nav === label ? "page" : undefined}
              className="relative flex w-full items-center gap-2.5 rounded-[var(--radius)] px-3 py-2 text-left text-sm hover:bg-[var(--page-hover)]"
            >
              {nav === label && (
                <motion.span
                  layoutId="identity-nav"
                  transition={spring.morph}
                  className="absolute inset-0 rounded-[var(--radius)] bg-[var(--primary-soft)]"
                >
                  <Facet className="absolute top-1/2 -left-[0.2rem] -mt-[0.2rem]" style={small} />
                </motion.span>
              )}
              <Icon
                aria-hidden="true"
                className={cn(
                  "relative size-4",
                  nav === label ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className={cn("relative", nav === label && "font-medium text-primary")}>
                {label}
              </span>
            </button>
          ))}
        </nav>
        <div role="radiogroup" aria-labelledby="identity-question" className="space-y-2">
          <p id="identity-question" className="mb-4 font-reading text-2xl">
            O que faz o céu parecer azul?
          </p>
          {["A atmosfera reflete a cor do oceano.", "O ar espalha mais a luz azul."].map(
            (text, index) => (
              <button
                key={text}
                type="button"
                role="radio"
                aria-checked={selected === index}
                onClick={() => setSelected(index)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[var(--radius)] border bg-card px-4 py-3 text-left text-sm",
                  selected === index
                    ? "border-primary bg-[var(--primary-soft)]"
                    : "border-border hover:bg-[var(--row-hover)]",
                )}
              >
                <Facet
                  state={selected === index ? "active" : "idle"}
                  style={{ "--facet-scale": selected === index ? 1.15 : 1 } as CSSProperties}
                />
                {text}
              </button>
            ),
          )}
        </div>
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Facet key={index} state={index < 3 ? "active" : "idle"} />
            ))}
            <span className="ml-2 text-sm text-muted-foreground tabular-nums">3 de 6</span>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <Facet state="active" />4 flashcards para revisar
            </li>
            <li className="flex items-center gap-3">
              <Facet state="gold" />
              <span>
                12 dominados <span className="text-[var(--gold-ink)]">· 3 hoje</span>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </Section>
  );
};

const StoneStages = () => {
  const [cut, setCut] = useState(0.55);
  const [dull, setDull] = useState(0);
  return (
    <Section
      id="stone"
      title="A pedra sendo lapidada"
      lead="A gamificação do início: a pedra começa bruta e vira a gema da marca conforme flashcards e questões são dominados. O brilho vem dos dias de estudo cumpridos na última semana. Cada estado vem com o nome escrito."
    >
      <div className="grid gap-10">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
          {[0, 0.25, 0.5, 0.75, 1].map((value) => (
            <figure key={value} className="grid justify-items-center gap-2">
              <CutGem cut={value} size={72} />
              <figcaption className="text-xs text-muted-foreground">
                {gemStage(value)} · {Math.round(value * 100)}%
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="grid gap-8 sm:grid-cols-[auto_1fr] sm:items-center">
          <CutGem cut={cut} dull={dull} size={120} />
          <div className="grid max-w-md gap-5">
            <label className="grid gap-2 text-sm">
              <span className="flex justify-between">
                <span>Lapidação</span>
                <span className="text-muted-foreground tabular-nums">
                  {gemStage(cut)} · {Math.round(cut * 100)}%
                </span>
              </span>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[cut]}
                onValueChange={([value]) => setCut(value ?? 0)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="flex justify-between">
                <span>Dias de estudo perdidos (brilho)</span>
                <span className="text-muted-foreground tabular-nums">
                  {Math.round(dull * 100)}%
                </span>
              </span>
              <Slider
                min={0}
                max={0.8}
                step={0.01}
                value={[dull]}
                onValueChange={([value]) => setDull(value ?? 0)}
              />
            </label>
          </div>
        </div>
      </div>
    </Section>
  );
};

const Motion = () => {
  const [distance, setDistance] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  // Travel the real track width (minus the marker and its insets), measured on each play.
  const play = () =>
    setDistance(distance ? 0 : Math.max(0, (track.current?.clientWidth ?? 0) - 36));
  const springs = [
    ["snap", "Clique e pressão. Rápido, sem sobra."],
    ["morph", "Um destaque que viaja entre opções. Um passo além, mínimo."],
    ["settle", "Algo que chega. Mais lento, pousa sem quicar."],
  ] as const;
  return (
    <Section
      id="motion"
      title="Três molas"
      lead="Todo movimento usa uma destas três. Com movimento reduzido, tudo vira troca imediata."
    >
      <div className="space-y-7">
        {springs.map(([name, role]) => (
          <div key={name} className="grid gap-x-8 gap-y-2 sm:grid-cols-[14rem_1fr] sm:items-center">
            <div>
              <p className="text-sm font-medium">{name}</p>
              <p className="text-sm text-muted-foreground">{role}</p>
            </div>
            <div
              ref={name === "snap" ? track : undefined}
              className="relative h-8 rounded-full bg-muted"
            >
              <motion.span
                className="absolute top-1/2 left-2 -mt-2.5 block size-5 rounded-[3px] bg-primary"
                animate={{ x: distance, rotate: 45 }}
                initial={false}
                transition={reduced ? { duration: 0 } : spring[name]}
              />
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={play}>
          Reproduzir
        </Button>
      </div>
      <MotionInPlace />
    </Section>
  );
};

const generationLabels = ["Gerar com IA", "Gerando…", "Revisar propostas"];

/** The pieces that need a real generation to appear in the app, shown here on demand. */
const MotionInPlace = () => {
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [rating, setRating] = useState<string | null>(null);
  const easy = useRef<HTMLButtonElement>(null);
  return (
    <div className="grid gap-x-10 gap-y-10 border-t border-border pt-10 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium">Rótulo que muda no lugar</p>
          <p className="text-sm text-muted-foreground">
            Só as letras que mudam se movem; a largura acompanha.
          </p>
        </div>
        <Button variant="outline" onClick={() => setStep((step + 1) % generationLabels.length)}>
          <MorphText text={generationLabels[step]!} />
        </Button>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium">Ouro do "Fácil"</p>
          <p className="text-sm text-muted-foreground">
            Só quando você lembra fácil: o ouro marca domínio.
          </p>
        </div>
        <div className="flex gap-2">
          {["Bom", "Fácil"].map((label) => (
            <Button
              key={label}
              ref={label === "Fácil" ? easy : undefined}
              variant="outline"
              onClick={() => {
                setRating(label);
                if (label === "Fácil" && easy.current) goldBurst(easy.current);
              }}
            >
              {label}
            </Button>
          ))}
          {rating && <span className="self-center text-sm text-muted-foreground">{rating}</span>}
        </div>
      </div>
      <div className="space-y-4 lg:col-span-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Espera da geração com IA</p>
            <p className="text-sm text-muted-foreground">
              No lugar do spinner: a gema e o contorno do que está chegando.
            </p>
          </div>
          <Button variant="outline" onClick={() => setPending(!pending)}>
            {pending ? "Esconder" : "Mostrar"}
          </Button>
        </div>
        {pending && <GenerationPending />}
      </div>
    </div>
  );
};

const Preview = () => (
  <Section
    id="preview"
    title="Como o app fica"
    lead="O início com os novos tokens: mesmo layout e mesmos textos. A pedra aparece só em momentos de marca, e aqui como faixa da saudação."
  >
    <div className="grid gap-6">
      {(["light", "dark"] as const).map((theme) => (
        <div
          key={theme}
          data-identity={theme}
          className="grid min-h-[30rem] overflow-hidden rounded-[var(--radius-panel)] border border-border sm:grid-cols-[13rem_1fr]"
        >
          <aside className="hidden space-y-5 bg-[var(--sidebar)] p-3 sm:block">
            <LazuliWordmark className="px-2 pt-1 text-lg" />
            <nav className="space-y-0.5 text-sm" aria-label="Prévia">
              {primaryNavigation.map(({ Icon, label }) => (
                <span
                  key={label}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-[var(--radius)] px-2 py-1.5",
                    label === "Início"
                      ? "bg-[var(--sidebar-accent)] font-medium"
                      : "text-muted-foreground",
                  )}
                >
                  {label === "Início" && (
                    <Facet className="absolute top-1/2 -left-[0.2rem] -mt-[0.2rem]" style={small} />
                  )}
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                </span>
              ))}
            </nav>
          </aside>
          <main className="min-w-0 bg-background">
            <div className="relative isolate overflow-hidden px-8 pt-10 pb-8 text-white">
              <LapisField className="absolute inset-0 -z-10" quality={0.6} />
              <p className="font-reading text-4xl font-medium">Boa tarde, Bruno</p>
              <p className="mt-2 text-sm text-white/85">12 flashcards dominados · 4 para hoje</p>
            </div>
            <div className="max-w-2xl space-y-8 px-8 py-8">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-panel)] border border-border bg-card p-6">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Seu próximo estudo</p>
                  <p className="mt-1 font-reading text-2xl">Memória e aprendizagem</p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <Facet style={small} />4 flashcards para revisar
                  </p>
                </div>
                <Button className={action}>
                  Revisar <ChevronRightIcon />
                </Button>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Documentos recentes</p>
                <div className="-mx-3">
                  {["Como estudar para lembrar", "Avaliação M2"].map((title, index) => (
                    <div
                      key={title}
                      className="flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 hover:bg-[var(--page-hover)]"
                    >
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="flex-1 truncate text-sm">{title}</span>
                      <span className="text-xs text-muted-foreground">
                        {index ? "ontem" : "hoje"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>
      ))}
    </div>
  </Section>
);
