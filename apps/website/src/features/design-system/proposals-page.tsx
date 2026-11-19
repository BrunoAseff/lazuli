import { Link } from "react-router";

import { ContentPage } from "@/components/content-page.tsx";

/*
 * Internal study page (development only). Holds proposals while they wait for approval; between
 * rounds it lists the latest approved ones and where to see them in the app.
 */

const applied = [
  {
    title: "Página do projeto",
    note: "No lugar do Início de cada projeto: estudo em cima (Revisar flashcards do projeto inteiro e as coleções com a faixa), documentos embaixo com quantos materiais saíram de cada um.",
    where: "Abra qualquer projeto em Projetos.",
    to: "/documents",
  },
  {
    title: "Criar materiais",
    note: "Um diálogo só, no cabeçalho do documento, na página do projeto e na coleção: fontes (um ou mais documentos do projeto), o que criar, quantos (1 a 10, com sugestão), onde salvar. Na revisão, itens que ligam documentos mostram um trecho de cada, e “Gerar mais 5” continua sem repetir.",
    where: "Criar materiais, na página de um projeto.",
    to: "/documents",
  },
  {
    title: "Seleção e trechos",
    note: "Shift+clique e arrastar pelas caixas selecionam vários itens de uma coleção; “Sublinhar trechos ligados” fica em Materiais ligados, no documento.",
    where: "Qualquer coleção de flashcards ou quiz.",
    to: "/flashcards",
  },
];

export default function ProposalsPage() {
  return (
    <ContentPage maxWidth="5xl">
      <h1 className="page-title">Propostas</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        Página interna de estudo. Nenhuma proposta em aberto; abaixo, as últimas aprovadas, já no
        app.
      </p>
      <div className="grid gap-3">
        {applied.map((item) => (
          <section className="surface-panel grid gap-1 p-5" key={item.title}>
            <h2 className="text-sm font-semibold">{item.title}</h2>
            <p className="max-w-3xl text-[0.8125rem] text-muted-foreground">{item.note}</p>
            <Link
              className="mt-1 w-fit text-[0.8125rem] underline-offset-4 hover:underline"
              to={item.to}
            >
              {item.where}
            </Link>
          </section>
        ))}
      </div>
    </ContentPage>
  );
}
