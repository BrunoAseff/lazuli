import { useState, type ReactNode } from "react";

import { CheckIcon, XIcon } from "@/components/icons.tsx";
import { ContentPage } from "@/components/content-page.tsx";
import { StudyAnswerChoice, StudyAnswerOutcome } from "@/components/study-answer-choice.tsx";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group.tsx";
import "@/components/study-answer-choice.css";
import "./proposals-page.css";

/*
 * Internal study (development only): options for the chosen, correct and wrong states, each beside
 * what exists today, to be chosen by looking at (and clicking) them.
 */

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

const answers = ["Mitocôndria", "Ribossomo", "Lisossomo"];

const Caption = ({ children }: { children: ReactNode }) => (
  <p className="mb-2 text-xs text-muted-foreground">{children}</p>
);

/** Options built on the app's real answer and option components, restyled per variant. */
const RealOption = ({ style }: { style: "current" | "gem" | "margin" }) => {
  const [picked, setPicked] = useState(1);
  return (
    <div className="proposal-states grid gap-5" data-states={style}>
      <div>
        <Caption>Respondendo (clique para escolher)</Caption>
        <div className="choices !mt-0">
          {answers.map((text, index) => (
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
        <Caption>Correção</Caption>
        <div className="choices !mt-0">
          <StudyAnswerOutcome correct={false} index={0} reveal={false} selected text="Ribossomo" />
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
        <Caption>Opção em formulário</Caption>
        <RadioGroup className="grid grid-cols-2 gap-2" defaultValue="claro">
          <RadioCard title="Claro" value="claro" />
          <RadioCard title="Escuro" value="escuro" />
        </RadioGroup>
      </div>
    </div>
  );
};

/** Pigment: drawn here as a mock, since it changes the text itself. */
const PigmentOption = () => {
  const [picked, setPicked] = useState(1);
  const [theme, setTheme] = useState("claro");
  return (
    <div className="grid gap-5">
      <div>
        <Caption>Respondendo (clique para escolher)</Caption>
        <div className="grid gap-2">
          {answers.map((text, index) => (
            <button
              className="pigment-choice"
              data-selected={picked === index || undefined}
              key={text}
              onClick={() => setPicked(index)}
              type="button"
            >
              <span className="pigment-letter">{String.fromCharCode(65 + index)}</span>
              <span className="pigment-text">{text}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <Caption>Correção</Caption>
        <div className="grid gap-2">
          <div className="pigment-choice" data-outcome="incorrect">
            <XIcon className="pigment-mark" />
            <span className="grid">
              <span className="pigment-text">Ribossomo</span>
              <span className="pigment-note">Sua resposta</span>
            </span>
          </div>
          <div className="pigment-choice" data-outcome="correct">
            <CheckIcon className="pigment-mark" />
            <span className="grid">
              <span className="pigment-text">Mitocôndria</span>
              <span className="pigment-note">Resposta correta</span>
            </span>
          </div>
        </div>
      </div>
      <div>
        <Caption>Opção em formulário</Caption>
        <div className="grid grid-cols-2 gap-2">
          {["Claro", "Escuro"].map((value) => (
            <button
              className="pigment-choice py-2.5"
              data-selected={theme === value || undefined}
              key={value}
              onClick={() => setTheme(value)}
              type="button"
            >
              <span className="pigment-radio" />
              <span className="pigment-text">{value}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function ProposalsPage() {
  return (
    <ContentPage maxWidth="6xl">
      <h1 className="page-title">Propostas</h1>
      <p className="mt-1 mb-8 max-w-2xl text-sm text-muted-foreground">
        Selecionado, correto e errado. Hoje a cor se repete na borda, no fundo e no selo; cada opção
        abaixo leva o estado num só lugar, com a linguagem do Lazúli. Nada aqui está aplicado no
        app.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Option label="Atual" note="Borda e fundo coloridos, mais o selo.">
          <RealOption style="current" />
        </Option>
        <Option
          label="C · Gema"
          note="Ao escolher, o selo redondo é lapidado em losango, como a gema da marca. O cartão fica branco; a correção usa a mesma gema em verde ou vermelho."
        >
          <RealOption style="gem" />
        </Option>
        <Option
          label="D · Margem"
          note="A faceta lápis da navegação marca a escolha na borda esquerda; na correção, ela fica verde ou vermelha. O selo continua neutro."
        >
          <RealOption style="margin" />
        </Option>
        <Option
          label="E · Pigmento"
          note="Leitura editorial: a escolha ganha um traço de pigmento ultramar atrás do texto; na correção, verde para a certa e um risco vermelho na errada."
        >
          <PigmentOption />
        </Option>
      </div>
    </ContentPage>
  );
}
