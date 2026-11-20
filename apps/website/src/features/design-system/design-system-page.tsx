import { useState } from "react";
import { ContentPage } from "@/components/content-page.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { ViewSelector } from "@/components/view-selector.tsx";
import { StudyReveal } from "@/components/study-reveal.tsx";
import { StudyAnswerChoice } from "@/components/study-answer-choice.tsx";
import { StudySessionProgress } from "@/components/study-session-progress.tsx";
import { AiCreditCost } from "@/features/ai/components/ai-credit-cost.tsx";
import { ReferenceSourcePreview } from "@/features/references/components/reference-source-preview.tsx";

/** Development-only, inert component bench. No API calls or fabricated account activity. */
export default function DesignSystemPage() {
  const [view, setView] = useState("graph");
  const [revealed, setRevealed] = useState(false);
  const [animateReveal, setAnimateReveal] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  return (
    <ContentPage maxWidth="6xl">
      <header className="mb-8">
        <p className="mb-2 text-sm text-muted-foreground">
          Bancada local · exemplos sem persistência
        </p>
        <h1 className="page-title">Sistema Lazúli</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Os componentes abaixo são os mesmos usados na aplicação. Esta página existe apenas no
          desenvolvimento para conferir estados, temas, teclado e movimento reduzido.
        </p>
      </header>
      <div className="grid items-start gap-8 xl:grid-cols-2">
        <section className="space-y-5 rounded-[var(--radius-panel)] bg-card p-6">
          <h2 className="font-heading text-xl">Prática · exemplo sem persistência</h2>
          <StudySessionProgress
            completed={choice === null ? 0 : 1}
            total={1}
            label="Progresso da questão de exemplo"
          />
          <p className="font-reading text-2xl">Qual ação ajuda a recuperar uma ideia?</p>
          <div className="space-y-1">
            {["Tentar explicar sem consultar o material.", "Apenas reler o mesmo trecho."].map(
              (text, index) => (
                <StudyAnswerChoice
                  key={text}
                  text={text}
                  index={index}
                  selected={choice === index}
                  onSelect={() => setChoice(index)}
                />
              ),
            )}
          </div>
          <Button variant="ghost" onClick={() => setChoice(null)}>
            Limpar exemplo
          </Button>
        </section>
        <section className="space-y-5 rounded-[var(--radius-panel)] bg-card p-6">
          <h2 className="font-heading text-xl">Cor e material</h2>
          <div className="grid grid-cols-3 gap-3 text-xs">
            {[
              ["Papel", "var(--background)"],
              ["Leitura", "var(--card)"],
              ["Sobreposição", "var(--popover)"],
              ["Tinta", "var(--foreground)"],
              ["Apoio", "var(--muted-foreground)"],
              ["Lápis-lazúli", "var(--primary)"],
            ].map(([name, color]) => (
              <div key={name}>
                <div
                  className="mb-2 h-16 rounded-lg border border-border/50"
                  style={{ background: color }}
                />
                {name}
              </div>
            ))}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Superfície não indica interação. Foco, seleção e hover têm funções diferentes.
          </p>
        </section>
        <section className="space-y-5 rounded-[var(--radius-panel)] bg-card p-6">
          <h2 className="font-heading text-xl">Ações e campos</h2>
          <div className="flex flex-wrap gap-2">
            <Button>Salvar</Button>
            <Button variant="outline">Cancelar</Button>
            <Button variant="ghost">Detalhes</Button>
            <Button variant="destructive">Excluir</Button>
            <Button disabled>Indisponível</Button>
          </div>
          <label className="block space-y-2 text-sm">
            Nome da coleção
            <Input placeholder="Ex.: Biologia celular" />
          </label>
          <label className="block space-y-2 text-sm">
            Campo com erro
            <Input aria-invalid aria-describedby="bench-field-error" defaultValue="" />
          </label>
          <p id="bench-field-error" className="text-sm text-destructive">
            Informe um nome para continuar.
          </p>
          <label className="flex items-center gap-3 text-sm">
            <Checkbox defaultChecked />
            Somente favoritos
          </label>
          <div className="flex items-center justify-between gap-4 text-sm">
            <label htmlFor="bench-compare">Comparar com período anterior</label>
            <Switch id="bench-compare" />
          </div>
          <Switch label="Comparação indisponível" disabled />
        </section>
        <section className="space-y-5 rounded-[var(--radius-panel)] bg-card p-6">
          <h2 className="font-heading text-xl">Seleção e continuidade</h2>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm">Sua prática</span>
            <ViewSelector
              label="Visualização"
              value={view}
              onChange={setView}
              options={[
                { value: "graph", label: "Gráfico" },
                { value: "table", label: "Tabela" },
              ]}
            />
          </div>
          <p role="status" className="text-sm text-muted-foreground">
            Visualização selecionada: {view === "graph" ? "gráfico" : "tabela"}.
          </p>
          <Tabs defaultValue="cards">
            <TabsList variant="line">
              <TabsTrigger value="cards">Flashcards</TabsTrigger>
              <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
            </TabsList>
            <TabsContent value="cards">Revisões de flashcards</TabsContent>
            <TabsContent value="quizzes">Respostas de quizzes</TabsContent>
          </Tabs>
          <AiCreditCost cost={120} available={2400} />
          <p className="text-xs text-muted-foreground">
            Valores de exemplo, sem vínculo com a conta.
          </p>
        </section>
        <section className="space-y-5 rounded-[var(--radius-panel)] bg-card p-6">
          <h2 className="font-heading text-xl">Do material à lembrança</h2>
          <p className="font-heading text-2xl leading-snug">O que é recuperação ativa?</p>
          {!revealed ? (
            <Button
              onClick={(event) => {
                setAnimateReveal(event.detail > 0);
                setRevealed(true);
              }}
            >
              Mostrar resposta
            </Button>
          ) : (
            <StudyReveal animated={animateReveal} label="Resposta de exemplo">
              <div className="space-y-4">
                <p className="text-sm leading-relaxed">
                  Tentar recuperar uma informação da memória antes de consultar o material.
                </p>
                <ReferenceSourcePreview text="Recordar uma ideia sem consultar o material e voltar a ela em momentos diferentes tornam o estudo mais ativo." />
                <Button variant="outline" onClick={() => setRevealed(false)}>
                  Ocultar resposta
                </Button>
              </div>
            </StudyReveal>
          )}
          <p className="text-sm text-muted-foreground">
            A pergunta permanece ancorada. O teclado e a redução de movimento eliminam a transição.
          </p>
        </section>
      </div>
    </ContentPage>
  );
}
