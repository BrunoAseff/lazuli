import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ContentPage } from "@/components/content-page.tsx";
import { StudyAnswerChoice, StudyAnswerOutcome } from "@/components/study-answer-choice.tsx";
import { Button } from "@/components/ui/button.tsx";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group.tsx";

/*
 * Internal study page (development only). Holds proposals while they wait for approval; between
 * rounds it shows the latest approved pieces, drawn with the real components.
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
  <section className="surface-panel mt-6 grid content-start gap-4 p-5 first:mt-0">
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </div>
    {children}
  </section>
);

const Caption = ({ children }: { children: ReactNode }) => (
  <p className="mb-2 text-xs text-muted-foreground">{children}</p>
);

const answers = ["Mitocôndria", "Ribossomo", "Lisossomo"];

const States = () => {
  const [picked, setPicked] = useState(1);
  const [run, setRun] = useState(0);
  return (
    <div className="grid gap-6 md:grid-cols-3">
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
        <Caption>
          Correção ·{" "}
          <button
            className="underline underline-offset-2"
            onClick={() => setRun(run + 1)}
            type="button"
          >
            repetir
          </button>
        </Caption>
        <div className="choices !mt-0" key={run}>
          {answers.map((text, index) => (
            <StudyAnswerOutcome
              correct={index === 0}
              index={index}
              key={text}
              selected={index === 1}
              text={text}
            />
          ))}
        </div>
      </div>
      <div>
        <Caption>Opção em formulário</Caption>
        <RadioGroup className="grid gap-2" defaultValue="claro">
          <RadioCard title="Claro" value="claro" />
          <RadioCard description="Segue o sistema" title="Automático" value="auto" />
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
        Página interna de estudo. Nenhuma proposta em aberto; abaixo, as últimas aprovadas, já no
        app.
      </p>
      <Section note="Faceta com tempo, aplicada." title="Toast">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => toast.success("Projeto criado.")} size="sm" variant="outline">
            Sucesso
          </Button>
          <Button
            onClick={() =>
              toast.error("Não foi possível salvar.", {
                description: "Verifique sua conexão e tente de novo.",
              })
            }
            size="sm"
            variant="outline"
          >
            Erro
          </Button>
          <Button
            onClick={() => toast.info("Trecho da fonte ajustado.")}
            size="sm"
            variant="outline"
          >
            Informação
          </Button>
        </div>
      </Section>
      <Section note="Pigmento, aplicado." title="Selecionado, correto e errado">
        <States />
      </Section>
    </ContentPage>
  );
}
