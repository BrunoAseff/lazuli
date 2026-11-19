import { useState, type ReactNode } from "react";

import {
  DocumentDomainIcon,
  FlashcardDomainIcon,
  QuizDomainIcon,
} from "@/components/domain-icons.ts";
import { FlashcardCollectionMark } from "@/components/flashcard-collection-mark.tsx";
import { ChevronDownIcon, MagicWandIcon, PlusIcon, XIcon } from "@/components/icons.tsx";
import { QuizCollectionMark } from "@/components/quiz-collection-mark.tsx";
import { QuantitySelector } from "@/components/quantity-selector.tsx";
import { StudyStrip, type StudyStripSegment } from "@/components/study-collection-card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Label } from "@/components/ui/label.tsx";
import { ViewSelector } from "@/components/view-selector.tsx";
import { ContentPage } from "@/components/content-page.tsx";

/*
 * Internal study page (development only): the project page as the place to study a project, and
 * one creation dialog for every entry point, with more than one source. Mocks drawn with the real
 * components; nothing here reaches the app.
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
    <h2 className="text-sm font-semibold">{title}</h2>
    <p className="mt-0.5 mb-5 max-w-3xl text-[0.8125rem] text-muted-foreground">{note}</p>
    {children}
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
  <div className="grid min-w-0 content-start gap-3">
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground md:min-h-[3lh]">{note}</p>
    </div>
    {children}
  </div>
);

/* Project page -------------------------------------------------------------------------------- */

const project = {
  title: "Exemplo: aprendendo a aprender",
  documents: [
    { title: "Como estudar para lembrar", updated: "ontem", flashcards: 4, questions: 2 },
    { title: "Coordenação entre tarefas e impasses", updated: "hoje", flashcards: 0, questions: 0 },
  ],
};

const flashcardSegments: StudyStripSegment[] = [
  { count: 7, label: "em dia", tone: "rest" },
  { count: 2, label: "para revisar", tone: "due" },
];
const quizSegments: StudyStripSegment[] = [
  { count: 3, label: "acertadas", tone: "correct" },
  { count: 1, label: "errada", tone: "incorrect" },
];

const collections = [
  {
    kind: "flashcard" as const,
    title: "Memória e aprendizagem",
    meta: "9 flashcards",
    action: "Revisar",
    segments: flashcardSegments,
    noun: { singular: "flashcard", plural: "flashcards" },
  },
  {
    kind: "quiz" as const,
    title: "Memória e aprendizagem",
    meta: "4 questões",
    action: "Responder",
    segments: quizSegments,
    noun: { singular: "questão", plural: "questões" },
  },
];

const ProjectHeader = () => (
  <header className="mb-6 flex items-center justify-between gap-6">
    <div className="min-w-0">
      <h3 className="page-title truncate">{project.title}</h3>
      <p className="mt-1 text-[0.8125rem] text-muted-foreground">2 documentos · 2 coleções</p>
    </div>
    <Button size="sm" variant="outline">
      <MagicWandIcon aria-hidden="true" /> Criar materiais
    </Button>
  </header>
);

/* The flashcards due across the project's collections, reviewed in one session. Quizzes keep their
   own action on their row: answering is not reviewing. */
const studySummary = "2 flashcards para revisar, de 1 coleção";

const CollectionRow = ({ item }: { item: (typeof collections)[number] }) => (
  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5">
    {item.kind === "flashcard" ? <FlashcardCollectionMark /> : <QuizCollectionMark />}
    <div className="min-w-0">
      <p className="truncate text-[0.9375rem] leading-snug font-medium underline-offset-4 hover:underline">
        {item.title}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {item.kind === "flashcard" ? "Flashcards" : "Quiz"} · {item.meta}
      </p>
    </div>
    <Button size="sm" variant="outline">
      {item.action}
    </Button>
    <div className="col-start-2 col-end-4">
      <StudyStrip
        emptyLabel="Nada estudado ainda"
        label={item.title}
        noun={item.noun}
        segments={item.segments}
      />
    </div>
  </div>
);

const NewCollection = () => (
  <Button
    className="h-auto w-fit px-0 py-0.5 text-muted-foreground hover:bg-transparent hover:text-foreground"
    size="xs"
    variant="ghost"
  >
    <PlusIcon aria-hidden="true" /> Nova coleção
  </Button>
);

const materialsOf = (doc: (typeof project.documents)[number]) =>
  doc.flashcards + doc.questions === 0
    ? "Nenhum material"
    : [
        doc.flashcards && `${doc.flashcards} flashcards`,
        doc.questions && `${doc.questions} questões`,
      ]
        .filter(Boolean)
        .join(" · ");

/** Narrow: study on top (what to do now and the collections), documents below. */
const HubStacked = () => (
  <>
    <div className="surface-panel grid gap-6 p-6">
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Estudo deste projeto</p>
          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{studySummary}</p>
        </div>
        <Button size="sm">Revisar flashcards</Button>
      </div>
      <div className="grid gap-5 border-t pt-5">
        {collections.map((item) => (
          <CollectionRow item={item} key={item.kind} />
        ))}
        <NewCollection />
      </div>
    </div>
    <div className="surface-panel mt-4 overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_9.5rem_6rem] border-b px-6 py-3 text-xs text-muted-foreground">
        <span>Documento</span>
        <span>Materiais</span>
        <span className="text-right">Atualizado em</span>
      </div>
      {project.documents.map((doc) => (
        <div
          className="grid grid-cols-[minmax(0,1fr)_9.5rem_6rem] items-center border-b px-6 py-3 last:border-b-0"
          key={doc.title}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <DocumentDomainIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm underline-offset-4 hover:underline">{doc.title}</span>
          </span>
          <span className="text-[0.8125rem] text-muted-foreground">{materialsOf(doc)}</span>
          <span className="text-right text-[0.8125rem] text-muted-foreground">{doc.updated}</span>
        </div>
      ))}
    </div>
  </>
);

/** Wide: documents and study side by side; each document says what came out of it. */
const HubColumns = () => (
  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,20rem)] items-start gap-4">
    <div className="surface-panel p-6">
      <p className="text-sm font-semibold">Documentos</p>
      <div className="mt-4 grid gap-4">
        {project.documents.map((doc) => (
          <div className="flex min-w-0 items-start gap-3" key={doc.title}>
            <DocumentDomainIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-[0.9375rem] leading-snug font-medium underline-offset-4 hover:underline">
                {doc.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {materialsOf(doc)} · atualizado {doc.updated}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className="surface-panel grid gap-5 p-6">
      <div>
        <p className="text-sm font-semibold">Estudo deste projeto</p>
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{studySummary}</p>
        <Button className="mt-3 w-full" size="sm">
          Revisar flashcards
        </Button>
      </div>
      <div className="grid gap-5 border-t pt-5">
        {collections.map((item) => (
          <div className="grid gap-2" key={item.kind}>
            <div className="flex min-w-0 items-center gap-2.5">
              {item.kind === "flashcard" ? (
                <FlashcardDomainIcon className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <QuizDomainIcon className="size-4 shrink-0 text-muted-foreground" />
              )}
              <p className="min-w-0 flex-1 truncate text-sm font-medium underline-offset-4 hover:underline">
                {item.title}
              </p>
              <Button className="shrink-0" size="xs" variant="outline">
                {item.action}
              </Button>
            </div>
            <StudyStrip
              emptyLabel="Nada estudado ainda"
              label={item.title}
              noun={item.noun}
              segments={item.segments}
            />
          </div>
        ))}
        <NewCollection />
      </div>
    </div>
  </div>
);

/** The project column as it is today, so the mock sits where "Início" opens. */
const ProjectColumn = () => (
  <div className="m-2 mr-0 grid w-[18rem] shrink-0 content-start gap-3 rounded-[var(--radius-panel)] bg-card p-3 text-sm">
    <p className="px-1 text-xs text-muted-foreground">‹ Projetos</p>
    <p className="truncate px-1 font-medium">{project.title}</p>
    <div className="flex h-8 items-center rounded-[var(--radius)] border px-2.5 text-[0.8125rem]">
      <PlusIcon className="mr-1.5 size-3.5" /> Novo documento
    </div>
    <div className="grid gap-0.5">
      <span className="relative rounded-md bg-muted px-2.5 py-1.5 font-medium">
        <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full bg-primary" />
        Início
      </span>
      {project.documents.map((doc) => (
        <span className="flex min-w-0 items-center gap-2 px-2.5 py-1.5" key={doc.title}>
          <DocumentDomainIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{doc.title}</span>
        </span>
      ))}
    </div>
  </div>
);

/** One page: side by side when the content area holds both (48rem), stacked when it does not. */
const ProjectHub = ({ width }: { width: string }) => (
  <div
    className="flex overflow-hidden rounded-[var(--radius-panel)] border bg-background"
    style={{ maxWidth: width }}
  >
    <ProjectColumn />
    <div className="min-w-0 flex-1 p-8">
      <ProjectHeader />
      <div className="@container">
        <div className="hidden @[48rem]:block">
          <HubColumns />
        </div>
        <div className="@[48rem]:hidden">
          <HubStacked />
        </div>
      </div>
    </div>
  </div>
);

/* Creation dialog ----------------------------------------------------------------------------- */

const DialogMock = ({
  children,
  footer,
  title,
}: {
  children: ReactNode;
  footer: ReactNode;
  title: string;
}) => (
  <div className="w-full max-w-[32rem] overflow-hidden rounded-[var(--radius-panel)] border bg-popover text-popover-foreground shadow-[var(--shadow-overlay)]">
    <div className="px-6 pt-6">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Você revisa as propostas antes de salvar.
      </p>
    </div>
    <div className="grid gap-5 px-6 pt-5 pb-6 text-sm">{children}</div>
    <div className="flex items-center justify-end gap-2 border-t px-6 py-4">{footer}</div>
  </div>
);

const Field = ({ children, label }: { children: ReactNode; label: string }) => (
  <div className="grid gap-2">
    <Label asChild>
      <p>{label}</p>
    </Label>
    {children}
  </div>
);

type Source = { title: string; scope: string };

const SourceList = ({ sources, removable }: { sources: Source[]; removable: boolean }) => (
  <div className="grid gap-1.5">
    {sources.map((source) => (
      <div className="flex h-6 min-w-0 items-center gap-2" key={source.title}>
        <DocumentDomainIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate">{source.title}</span>
        <span className="shrink-0 text-muted-foreground">· {source.scope}</span>
        {removable ? (
          <button
            aria-label={`Tirar ${source.title}`}
            className="ml-auto grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-foreground"
            type="button"
          >
            <XIcon className="size-3.5" />
          </button>
        ) : (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">Ver texto</span>
        )}
      </div>
    ))}
    <Button
      className="mt-1 h-auto w-fit px-0 py-0.5 text-muted-foreground hover:bg-transparent hover:text-foreground"
      size="xs"
      variant="ghost"
    >
      <PlusIcon aria-hidden="true" /> Adicionar documento do projeto
    </Button>
  </div>
);

const CreateDialog = ({ sources }: { sources: Source[] }) => {
  const [kind, setKind] = useState("flashcard");
  const many = sources.length > 1;
  const [quantity, setQuantity] = useState(many ? 10 : 8);
  return (
    <DialogMock
      footer={
        <>
          <span className="mr-auto text-[0.8125rem] text-muted-foreground">
            {quantity * 10} créditos · saldo 19.640
          </span>
          <Button size="sm" variant="outline">
            Cancelar
          </Button>
          <Button size="sm">
            <MagicWandIcon aria-hidden="true" /> Gerar propostas
          </Button>
        </>
      }
      title="Criar materiais com IA"
    >
      <Field label={many ? "Fontes" : "Fonte"}>
        <SourceList removable={many} sources={sources} />
        {many && (
          <p className="text-xs text-muted-foreground">
            Além de itens de cada documento, a IA pode ligar ideias entre eles, só quando um trecho
            de cada um sustenta a ligação.
          </p>
        )}
      </Field>
      <Field label="O que criar?">
        <ViewSelector
          fullWidth
          label="O que criar"
          onChange={setKind}
          options={[
            { value: "flashcard", label: "Flashcards" },
            { value: "quiz", label: "Questões" },
          ]}
          value={kind}
        />
      </Field>
      <Field label={kind === "flashcard" ? "Quantos?" : "Quantas?"}>
        <QuantitySelector
          label="Quantidade"
          onChange={setQuantity}
          options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
          value={quantity}
        />
        <p className="text-xs text-muted-foreground">
          {many
            ? "10 sugeridos para cerca de 5.100 palavras. Depois de revisar, dá para gerar mais."
            : "8 sugeridos para cerca de 2.400 palavras. Depois de revisar, dá para gerar mais."}
        </p>
      </Field>
      <Field label="Salvar em">
        <div className="flex h-9 items-center justify-between gap-3 rounded-[var(--radius)] border border-input bg-background px-3">
          <span className="truncate">
            {kind === "flashcard"
              ? "Memória e aprendizagem"
              : "Nova coleção: Como estudar para lembrar"}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </div>
      </Field>
      <Button
        className="h-auto w-fit px-0 py-0.5 text-muted-foreground hover:bg-transparent hover:text-foreground"
        size="xs"
        variant="ghost"
      >
        <PlusIcon aria-hidden="true" /> Adicionar orientação para a IA
      </Button>
    </DialogMock>
  );
};

const oneSource: Source[] = [{ title: "Como estudar para lembrar", scope: "documento inteiro" }];
const twoSources: Source[] = [
  { title: "Como estudar para lembrar", scope: "documento inteiro" },
  { title: "Coordenação entre tarefas e impasses", scope: "seção “Impasses”" },
];

/** What "+ Adicionar documento do projeto" opens. */
const SourcePicker = () => {
  const [picked, setPicked] = useState([true, true, false]);
  const docs = [
    "Como estudar para lembrar",
    "Coordenação entre tarefas e impasses",
    "Resumo da aula 3",
  ];
  return (
    <div className="w-full max-w-[20rem] rounded-[var(--radius)] border bg-popover p-1.5 shadow-[var(--shadow-float)]">
      <p className="px-2.5 pt-1.5 pb-2 text-xs text-muted-foreground">
        Documentos de Exemplo: aprendendo a aprender
      </p>
      {docs.map((doc, index) => (
        <label
          className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-[var(--card-hover)]"
          key={doc}
        >
          <Checkbox
            checked={picked[index]}
            onCheckedChange={(value) =>
              setPicked(picked.map((current, at) => (at === index ? value === true : current)))
            }
          />
          <span className="truncate">{doc}</span>
        </label>
      ))}
    </div>
  );
};

/** A proposal that links two documents, as it would appear in review. */
const LinkedProposal = () => (
  <div className="grid w-full max-w-[32rem] gap-4 rounded-[var(--radius-panel)] border bg-card p-5 text-sm">
    <div>
      <p className="text-xs text-muted-foreground">Pergunta</p>
      <p className="mt-1 font-reading text-base leading-snug">
        Por que tentar lembrar antes de reler ajuda a destravar um impasse numa tarefa?
      </p>
    </div>
    <div>
      <p className="text-xs text-muted-foreground">Resposta</p>
      <p className="mt-1 leading-relaxed">
        O esforço de recuperação mostra o que falta saber; num impasse, isso aponta qual parte da
        tarefa precisa ser revista.
      </p>
    </div>
    <div className="grid gap-2.5 border-t pt-4">
      <p className="text-xs font-medium">Liga 2 documentos</p>
      {[
        ["Como estudar para lembrar", "Esse esforço revela lacunas e fortalece o caminho…"],
        ["Coordenação entre tarefas e impasses", "Um impasse aparece quando falta uma informação…"],
      ].map(([title, quote]) => (
        <div className="grid gap-1" key={title}>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <DocumentDomainIcon className="size-3.5" /> {title}
          </span>
          <span className="source-excerpt font-reading text-[0.875rem] leading-relaxed">
            {quote}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const ReviewFooter = () => (
  <div className="flex w-full max-w-[32rem] items-center justify-end gap-2 rounded-[var(--radius-panel)] border bg-popover px-5 py-4">
    <Button className="mr-auto" size="sm" variant="ghost">
      <PlusIcon aria-hidden="true" /> Gerar mais 5
    </Button>
    <Button size="sm" variant="outline">
      Fechar
    </Button>
    <Button size="sm">Salvar 8 flashcards</Button>
  </div>
);

const entries = [
  ["Texto selecionado no documento", "O trecho como fonte; até 5 itens, porque o texto é curto."],
  ["“Criar materiais de estudo”, no cabeçalho do documento", "O documento inteiro como fonte."],
  ["“Criar materiais”, na página do projeto", "A lista de documentos do projeto para marcar."],
  ["“Gerar com IA”, dentro de uma coleção", "A coleção como destino; a fonte fica por escolher."],
];

export default function ProposalsPage() {
  return (
    <ContentPage maxWidth="6xl">
      <h1 className="page-title">Propostas</h1>
      <p className="mt-1 mb-10 text-sm text-muted-foreground">
        Página interna de estudo, para aprovação. Nada aqui está aplicado no app.
      </p>

      <Section
        note="Entra no lugar do “Início” de cada projeto, com a árvore de arquivos ao lado como hoje. Quando a área de conteúdo tem espaço (48rem, cerca de uma tela de 1440px com a árvore aberta), documentos e estudo ficam lado a lado; quando não tem, a mesma página empilha: estudo em cima, documentos embaixo. “Revisar flashcards” abre uma sessão só com os flashcards pendentes de todas as coleções do projeto, misturados; as questões continuam no “Responder” de cada quiz. Sem nada pendente, o resumo diz “Tudo revisado” e o botão sai."
        title="Página do projeto"
      >
        <div className="grid gap-12">
          <Option label="Com espaço: lado a lado" note="Área de conteúdo a partir de 48rem.">
            <ProjectHub width="100%" />
          </Option>
          <Option
            label="Sem espaço: empilhada"
            note="Área de conteúdo abaixo de 48rem (por exemplo, telas de 1280px)."
          >
            <ProjectHub width="58rem" />
          </Option>
        </div>
      </Section>

      <Section
        note="Um único diálogo, com as mesmas perguntas na mesma ordem (fontes, o que criar, quantos, onde salvar), aberto de qualquer lugar. Cada entrada só muda o que já vem preenchido. Nenhum botão novo no cabeçalho do documento: mais fontes entram pelo próprio campo Fonte."
        title="Criar materiais"
      >
        <div className="mb-8 max-w-3xl overflow-hidden rounded-[var(--radius-panel)] border bg-card">
          {entries.map(([from, filled]) => (
            <div
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 border-b px-5 py-3 text-sm last:border-b-0"
              key={from}
            >
              <span>{from}</span>
              <span className="text-muted-foreground">{filled}</span>
            </div>
          ))}
        </div>
        <div className="grid gap-12">
          <div className="grid items-start gap-8 md:grid-cols-2">
            <Option
              label="Um documento, como abre do cabeçalho"
              note="Igual ao de hoje, com três mudanças: “Salvar em” vem por último e sugere a coleção do projeto (ou uma nova com o nome do documento), a quantidade vem sugerida pelo tamanho da fonte, e dá para escolher de 1 a 10, o mesmo em todos os caminhos (no trecho selecionado, de 1 a 5)."
            >
              <CreateDialog sources={oneSource} />
            </Option>
            <Option
              label="Dois documentos"
              note="“+ Adicionar documento do projeto” abre a lista abaixo; uma seção pode ser escolhida quando o documento é grande. Com mais de uma fonte aparece a única frase de explicação, sobre as ligações."
            >
              <CreateDialog sources={twoSources} />
            </Option>
          </div>
          <div className="grid items-start gap-8 md:grid-cols-2">
            <Option
              label="Escolher documentos"
              note="Aberta pelo “+ Adicionar documento do projeto”. Só os documentos do mesmo projeto, marcados por caixa."
            >
              <SourcePicker />
            </Option>
            <Option
              label="Na revisão: um item que liga dois documentos"
              note="O item mostra os dois trechos que o sustentam. Sem um trecho de cada lado, a IA não cria a ligação. No rodapé, “Gerar mais 5” continua do que ainda não foi coberto, em vez de pedir um número grande de uma vez."
            >
              <div className="grid w-full gap-3">
                <LinkedProposal />
                <ReviewFooter />
              </div>
            </Option>
          </div>
        </div>
      </Section>
    </ContentPage>
  );
}
