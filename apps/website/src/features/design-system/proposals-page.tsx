import { useState, type ReactNode } from "react";

import { CutGem, gemStage, type RoughStyle } from "@/components/brand/cut-gem.tsx";
import { CheckIcon, InfoIcon, XIcon } from "@/components/icons.tsx";
import { ContentPage } from "@/components/content-page.tsx";
import { StudyAnswerChoice, StudyAnswerOutcome } from "@/components/study-answer-choice.tsx";
import { Button } from "@/components/ui/button.tsx";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group.tsx";
import "@/components/study-answer-choice.css";
import "./proposals-page.css";

/*
 * Internal study (development only): options for the rough stone, the toast and the chosen,
 * correct and wrong states, each beside what exists today, to be chosen by looking at them.
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
  <section className="mt-12 first:mt-0">
    <h2 className="text-sm font-semibold">{title}</h2>
    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{note}</p>
    <div className="mt-5">{children}</div>
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
  <div className="surface-panel grid content-start gap-4 p-5">
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </div>
    {children}
  </div>
);

/* Stone ------------------------------------------------------------------------------------- */

const stones: { style: RoughStyle; label: string; note: string }[] = [
  { style: "classic", label: "Atual", note: "Um corpo liso com um brilho e uma sombra." },
  {
    style: "angular",
    label: "A · Angular",
    note: "Faces planas e irregulares, cada uma sombreada pela luz de cima à esquerda.",
  },
  {
    style: "mineral",
    label: "B · Mineral",
    note: "A forma angular com pequenas inclusões de calcita, como o lápis bruto real.",
  },
];

const StoneOptions = () => (
  <div className="grid gap-4 md:grid-cols-3">
    {stones.map(({ label, note, style }) => (
      <Option key={style} label={label} note={note}>
        <div className="flex items-end gap-4">
          {[0, 0.25, 0.5].map((cut) => (
            <div className="grid justify-items-center gap-1.5" key={cut}>
              <CutGem cut={cut} rough={style} size={72} />
              <span className="text-xs text-muted-foreground">{gemStage(cut)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CutGem cut={0} rough={style} size={28} /> No guia da pedra (28px)
        </div>
      </Option>
    ))}
  </div>
);

/* Toast ------------------------------------------------------------------------------------- */

type Tone = "success" | "error" | "info";
type ToastStyle = "current" | "glyph" | "facet" | "timed";

const toastExamples: { tone: Tone; title: string; description?: string }[] = [
  { tone: "success", title: "Projeto criado." },
  {
    tone: "error",
    title: "Não foi possível salvar.",
    description: "Verifique sua conexão e tente de novo.",
  },
  { tone: "info", title: "Trecho da fonte ajustado." },
];

const toneIcon = { success: CheckIcon, error: XIcon, info: InfoIcon };

const ToastMock = ({
  description,
  style,
  title,
  tone,
}: {
  description?: string;
  style: ToastStyle;
  title: string;
  tone: Tone;
}) => {
  const Icon = toneIcon[tone];
  return (
    <div className="mock-toast" data-style={style} data-tone={tone}>
      {style === "current" ? (
        <span className="mock-toast-seal">
          <Icon />
        </span>
      ) : style === "glyph" ? (
        <Icon className="mock-toast-glyph" />
      ) : (
        <span className="mock-toast-facet" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        {description && (
          <span className="block text-[0.8125rem] text-muted-foreground">{description}</span>
        )}
      </span>
      <XIcon className="mock-toast-close" />
      {style === "timed" && <span className="mock-toast-time" />}
    </div>
  );
};

const toastOptions: { style: ToastStyle; label: string; note: string }[] = [
  { style: "current", label: "Atual", note: "Selo redondo de 28px preenchido com a cor." },
  {
    style: "glyph",
    label: "A · Glifo",
    note: "Só o ícone, pequeno e na cor do tipo. Mais compacto, sem selo.",
  },
  {
    style: "facet",
    label: "B · Faceta",
    note: "A faceta da marca na cor do tipo; ao entrar, ela gira e assenta, como uma gema no lugar.",
  },
  {
    style: "timed",
    label: "C · Faceta com tempo",
    note: "A faceta e, na base, o tempo restante; passar o mouse pausa a contagem.",
  },
];

const ToastOptions = () => {
  const [run, setRun] = useState(0);
  return (
    <>
      <Button className="mb-4" onClick={() => setRun(run + 1)} size="sm" variant="outline">
        Repetir entrada
      </Button>
      <div className="grid gap-4 md:grid-cols-2">
        {toastOptions.map(({ label, note, style }) => (
          <Option key={style} label={label} note={note}>
            <div className="grid gap-2" key={run}>
              {toastExamples.map((example, index) => (
                <div
                  key={example.title}
                  style={{ animationDelay: `${index * 90}ms` }}
                  className="mock-toast-enter"
                >
                  <ToastMock {...example} style={style} />
                </div>
              ))}
            </div>
          </Option>
        ))}
      </div>
    </>
  );
};

/* States ------------------------------------------------------------------------------------ */

type StateStyle = "current" | "seal" | "lift";

const stateOptions: { style: StateStyle; label: string; note: string }[] = [
  {
    style: "current",
    label: "Atual",
    note: "Borda colorida e fundo da mesma cor com pouca opacidade.",
  },
  {
    style: "seal",
    label: "A · O selo conduz",
    note: "O cartão fica branco e neutro; só o selo e a frase de status levam a cor.",
  },
  {
    style: "lift",
    label: "B · Elevação",
    note: "O escolhido se eleva com uma sombra curta e borda de tinta; a cor fica no selo.",
  },
];

const StateOptions = () => {
  const [picked, setPicked] = useState(1);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {stateOptions.map(({ label, note, style }) => (
        <Option key={style} label={label} note={note}>
          <div className="proposal-states grid gap-5" data-states={style}>
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Respondendo</p>
              <div className="choices !mt-0">
                {["Mitocôndria", "Ribossomo", "Lisossomo"].map((text, index) => (
                  <StudyAnswerChoice
                    index={index}
                    key={text}
                    onSelect={() => setPicked(index)}
                    selected={picked === index}
                    text={text}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Correção</p>
              <div className="choices !mt-0">
                <StudyAnswerOutcome
                  correct={false}
                  index={0}
                  reveal={false}
                  selected
                  text="Ribossomo"
                />
                <StudyAnswerOutcome
                  correct
                  index={1}
                  reveal={false}
                  selected={false}
                  text="Mitocôndria"
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Opção em formulário</p>
              <RadioGroup className="grid grid-cols-2 gap-2" defaultValue="claro">
                <RadioCard title="Claro" value="claro" />
                <RadioCard title="Escuro" value="escuro" />
              </RadioGroup>
            </div>
          </div>
        </Option>
      ))}
    </div>
  );
};

export default function ProposalsPage() {
  return (
    <ContentPage maxWidth="6xl">
      <h1 className="page-title">Propostas</h1>
      <p className="mt-1 mb-10 text-sm text-muted-foreground">
        Página interna de estudo. Nada aqui está aplicado no app.
      </p>
      <Section
        note="Hoje a pedra bruta é um contorno liso com um brilho e uma sombra, e lê como um desenho, não como pedra. As opções trocam isso por faces planas iluminadas por uma luz só."
        title="Pedra bruta"
      >
        <StoneOptions />
      </Section>
      <Section
        note="O selo de 28px pesa mais que a mensagem. As opções levam o tipo num sinal pequeno e deixam a graça no movimento, como fazem os toasts mais cuidados."
        title="Toast"
      >
        <ToastOptions />
      </Section>
      <Section
        note="Selecionado, correto e errado hoje repetem a cor três vezes (borda, fundo e selo). As opções deixam a cor só onde ela informa."
        title="Selecionado, correto e errado"
      >
        <StateOptions />
      </Section>
    </ContentPage>
  );
}
