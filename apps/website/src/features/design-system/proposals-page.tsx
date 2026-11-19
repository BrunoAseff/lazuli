import { useState, type ReactNode } from "react";

import { CheckIcon, InfoIcon, XIcon } from "@/components/icons.tsx";
import { ContentPage } from "@/components/content-page.tsx";
import { StudyAnswerChoice, StudyAnswerOutcome } from "@/components/study-answer-choice.tsx";
import { Button } from "@/components/ui/button.tsx";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group.tsx";
import "@/components/study-answer-choice.css";
import "./proposals-page.css";

/*
 * Internal study (development only): the adjusted toast and the adjusted pigment states, each
 * beside what the app shows today, for approval. Nothing here reaches the app.
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

const Section = ({ children, title }: { children: ReactNode; title: string }) => (
  <section className="mt-12 first:mt-0">
    <h2 className="mb-4 text-sm font-semibold">{title}</h2>
    {children}
  </section>
);

const Caption = ({ children }: { children: ReactNode }) => (
  <p className="mb-2 text-xs text-muted-foreground">{children}</p>
);

/* Toast ------------------------------------------------------------------------------------- */

type Tone = "success" | "error" | "info";
const toneIcon = { success: CheckIcon, error: XIcon, info: InfoIcon };
const toastExamples: { tone: Tone; title: string; description?: string }[] = [
  { tone: "success", title: "Projeto criado." },
  {
    tone: "error",
    title: "Não foi possível salvar.",
    description: "Verifique sua conexão e tente de novo.",
  },
  { tone: "info", title: "Trecho da fonte ajustado." },
];

const ToastMock = ({
  adjusted,
  description,
  title,
  tone,
}: {
  adjusted: boolean;
  description?: string;
  title: string;
  tone: Tone;
}) => {
  const Icon = toneIcon[tone];
  return (
    <div className="mock-toast" data-adjusted={adjusted || undefined} data-tone={tone}>
      {adjusted ? (
        <span className="mock-toast-facet" />
      ) : (
        <span className="mock-toast-seal">
          <Icon />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        {description && (
          <span className="block text-[0.8125rem] text-muted-foreground">{description}</span>
        )}
      </span>
      <XIcon className="mock-toast-close" />
      {adjusted && (
        <span aria-hidden="true" className="mock-toast-time-clip">
          <span className="mock-toast-time" />
        </span>
      )}
    </div>
  );
};

const ToastProposal = () => {
  const [run, setRun] = useState(0);
  return (
    <>
      <Button className="mb-4" onClick={() => setRun(run + 1)} size="sm" variant="outline">
        Repetir entrada
      </Button>
      <div className="grid gap-4 md:grid-cols-2">
        {[false, true].map((adjusted) => (
          <Option
            key={String(adjusted)}
            label={adjusted ? "C · Faceta com tempo, ajustado" : "Atual"}
            note={
              adjusted
                ? "320px de largura (era 356), 10px de respiro vertical (era 12), sombra curta e leve (2px/10px a 7%, era 16px/48px). A faceta gira e assenta ao entrar; a linha mostra o tempo e pausa com o mouse em cima."
                : "Selo redondo de 28px preenchido e a sombra grande dos diálogos."
            }
          >
            <div className="grid gap-2" key={run}>
              {toastExamples.map((example, index) => (
                <div
                  className="mock-toast-enter"
                  key={example.title}
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <ToastMock {...example} adjusted={adjusted} />
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

const answers = ["Mitocôndria", "Ribossomo", "Lisossomo"];

const StatesProposal = ({ pigment }: { pigment: boolean }) => {
  const [picked, setPicked] = useState(1);
  return (
    <div className="grid gap-5" data-states={pigment ? "pigment" : "current"}>
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
        {pigment ? (
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
        ) : (
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
        )}
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

export default function ProposalsPage() {
  return (
    <ContentPage maxWidth="6xl">
      <h1 className="page-title">Propostas</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        Página interna de estudo, para aprovação. Nada aqui está aplicado no app.
      </p>
      <Section title="Toast">
        <ToastProposal />
      </Section>
      <Section title="Selecionado, correto e errado">
        <div className="grid gap-4 md:grid-cols-2">
          <Option label="Atual" note="Borda e fundo coloridos, mais o selo.">
            <StatesProposal pigment={false} />
          </Option>
          <Option
            label="E · Pigmento, ajustado"
            note="Ao escolher, o selo preenche como hoje e o texto ganha o traço de pigmento ultramar; o cartão fica branco. Na correção, traço verde na certa e risco vermelho na errada."
          >
            <StatesProposal pigment />
          </Option>
        </div>
      </Section>
    </ContentPage>
  );
}
