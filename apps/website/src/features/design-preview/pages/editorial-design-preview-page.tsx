import { ArchiveIcon } from "@phosphor-icons/react/Archive";
import { ArrowLeftIcon } from "@phosphor-icons/react/ArrowLeft";
import { CardsThreeIcon } from "@phosphor-icons/react/CardsThree";
import { CheckIcon } from "@phosphor-icons/react/Check";
import { FunnelSimpleIcon } from "@phosphor-icons/react/FunnelSimple";
import { GridFourIcon } from "@phosphor-icons/react/GridFour";
import { ListBulletsIcon } from "@phosphor-icons/react/ListBullets";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/MagnifyingGlass";
import { PlusIcon } from "@phosphor-icons/react/Plus";
import { SortAscendingIcon } from "@phosphor-icons/react/SortAscending";
import { UploadSimpleIcon } from "@phosphor-icons/react/UploadSimple";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { EditorialSidebar } from "@/features/design-preview/components/editorial-sidebar.tsx";
import {
  EditorialFlashcard,
  EditorialPracticeCallout,
  previewFlashcards,
} from "@/features/design-preview/components/editorial-study-samples.tsx";
import { cn } from "@/lib/utils.ts";

const metrics = [
  { label: "Novos", value: "104" },
  { label: "Estudados", value: "32" },
  { label: "Para revisar", value: "132" },
  { label: "Próxima revisão", value: "Agora" },
] as const;

export const EditorialDesignPreviewPage = () => {
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => new Set<string>());

  const cards = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return previewFlashcards;
    return previewFlashcards.filter((card) =>
      `${card.question} ${card.answer}`.toLocaleLowerCase("pt-BR").includes(normalized),
    );
  }, [query]);

  const toggleCard = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="archive-preview" id="preview-top">
      <EditorialSidebar />
      <main className="archive-main">
        <div className="archive-page">
          <header className="archive-page-header">
            <div className="archive-heading-copy">
              <Link className="archive-back" to="/flashcards">
                <ArrowLeftIcon aria-hidden="true" size={15} />
                Flashcards
              </Link>
              <p className="archive-kicker">Fichário · Geografia</p>
              <h1>Espanha</h1>
              <p className="archive-project-name">Projeto Geoguessr</p>
            </div>
            <div className="archive-page-actions">
              <button className="archive-button is-secondary" type="button">
                <UploadSimpleIcon aria-hidden="true" size={16} /> Importar
              </button>
              <NewFlashcardDialog />
              <button className="archive-button is-primary" type="button">
                <CardsThreeIcon aria-hidden="true" size={17} weight="duotone" />
                Praticar <span>132</span>
              </button>
            </div>
          </header>

          <dl className="archive-ledger">
            {metrics.map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <EditorialPracticeCallout />

          <section aria-label="Catálogo de flashcards" className="archive-catalog">
            <div className="archive-catalog-toolbar">
              <div className="archive-search">
                <MagnifyingGlassIcon aria-hidden="true" size={17} />
                <input
                  aria-label="Pesquisar pergunta ou resposta"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Pesquisar pergunta ou resposta"
                  type="search"
                  value={query}
                />
              </div>
              <button className="archive-filter" type="button">
                <FunnelSimpleIcon aria-hidden="true" size={16} /> Todos
              </button>
              <button className="archive-filter" type="button">
                <SortAscendingIcon aria-hidden="true" size={16} /> Atualizados
              </button>
              <div aria-label="Visualização" className="archive-view-toggle">
                <button
                  aria-label="Visualização em cards"
                  aria-pressed={layout === "grid"}
                  onClick={() => setLayout("grid")}
                  type="button"
                >
                  <GridFourIcon aria-hidden="true" size={17} />
                </button>
                <button
                  aria-label="Visualização em lista"
                  aria-pressed={layout === "list"}
                  onClick={() => setLayout("list")}
                  type="button"
                >
                  <ListBulletsIcon aria-hidden="true" size={17} />
                </button>
              </div>
            </div>

            <div className={cn("archive-selection-bar", selected.size > 0 && "is-visible")}>
              <span>
                <CheckIcon aria-hidden="true" size={14} weight="bold" />
                {selected.size} {selected.size === 1 ? "ficha selecionada" : "fichas selecionadas"}
              </span>
              <div>
                <button type="button">Mover</button>
                <button type="button">
                  <ArchiveIcon aria-hidden="true" size={15} /> Arquivar
                </button>
                <button onClick={() => setSelected(new Set())} type="button">
                  Desmarcar
                </button>
              </div>
            </div>

            {cards.length > 0 ? (
              <div className={cn("archive-flashcard-catalog", `is-${layout}`)}>
                {cards.map((card) => (
                  <EditorialFlashcard
                    card={card}
                    key={card.id}
                    layout={layout}
                    onSelect={() => toggleCard(card.id)}
                    selected={selected.has(card.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="archive-empty-state">
                <CardsThreeIcon aria-hidden="true" size={25} weight="duotone" />
                <p>Nenhuma ficha corresponde à pesquisa.</p>
              </div>
            )}

            <footer className="archive-pagination">
              <span>1–6 de 132 fichas</span>
              <div>
                <button disabled type="button">
                  Anterior
                </button>
                <button type="button">
                  Próxima <span aria-hidden="true">→</span>
                </button>
              </div>
            </footer>
          </section>
        </div>
      </main>
    </div>
  );
};

const NewFlashcardDialog = () => (
  <Dialog>
    <DialogTrigger asChild>
      <button className="archive-button is-secondary" type="button">
        <PlusIcon aria-hidden="true" size={16} /> Nova ficha
      </button>
    </DialogTrigger>
    <DialogContent className="archive-dialog sm:max-w-2xl">
      <DialogHeader className="archive-dialog-header">
        <p className="archive-kicker">F–027 · Espanha</p>
        <DialogTitle>Adicionar flashcard</DialogTitle>
        <DialogDescription>
          Registre uma ideia que possa ser recuperada de forma objetiva.
        </DialogDescription>
      </DialogHeader>
      <div className="archive-dialog-body">
        <label htmlFor="archive-question">Pergunta</label>
        <Textarea
          className="archive-dialog-field"
          id="archive-question"
          placeholder="O que você deseja lembrar?"
          rows={4}
        />
        <label htmlFor="archive-answer">Resposta</label>
        <Textarea
          className="archive-dialog-field"
          id="archive-answer"
          placeholder="Escreva uma resposta curta e verificável"
          rows={4}
        />
      </div>
      <DialogFooter className="archive-dialog-footer">
        <DialogCancelButton className="archive-button is-secondary">Cancelar</DialogCancelButton>
        <button className="archive-button is-primary" type="button">
          Adicionar ficha
        </button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default EditorialDesignPreviewPage;
