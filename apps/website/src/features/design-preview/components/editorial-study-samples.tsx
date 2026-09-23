import { ArchiveIcon } from "@phosphor-icons/react/Archive";
import { ArrowRightIcon } from "@phosphor-icons/react/ArrowRight";
import { CheckIcon } from "@phosphor-icons/react/Check";
import { DotsThreeIcon } from "@phosphor-icons/react/DotsThree";
import { LinkSimpleIcon } from "@phosphor-icons/react/LinkSimple";
import { PencilSimpleIcon } from "@phosphor-icons/react/PencilSimple";
import { RepeatIcon } from "@phosphor-icons/react/Repeat";
import { TrashIcon } from "@phosphor-icons/react/Trash";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { cn } from "@/lib/utils.ts";

export type PreviewFlashcard = {
  answer: string;
  due: string;
  id: string;
  question: string;
  references: number;
  state: "Novo" | "Aprendendo" | "Revisão";
};

export const previewFlashcards: PreviewFlashcard[] = [
  {
    answer: "Porque força a recuperação da informação antes que ela seja esquecida.",
    due: "Agora",
    id: "F–021",
    question: "Por que a revisão espaçada melhora a retenção?",
    references: 2,
    state: "Aprendendo",
  },
  {
    answer: "É o esforço de recordar sem consultar imediatamente o material.",
    due: "Hoje, 18:40",
    id: "F–022",
    question: "O que caracteriza a recuperação ativa?",
    references: 1,
    state: "Revisão",
  },
  {
    answer: "Dividir conceitos complexos em unidades pequenas e verificáveis.",
    due: "Amanhã",
    id: "F–023",
    question: "Qual princípio torna um flashcard mais fácil de avaliar?",
    references: 0,
    state: "Novo",
  },
  {
    answer: "A dificuldade estimada da lembrança e a estabilidade da memória.",
    due: "Em 3 dias",
    id: "F–024",
    question: "Quais propriedades o FSRS acompanha para agendar uma revisão?",
    references: 3,
    state: "Revisão",
  },
  {
    answer: "Ela reconstrói a ideia e revela lacunas que a releitura esconde.",
    due: "Em 5 dias",
    id: "F–025",
    question: "Por que explicar um conceito com palavras próprias ajuda a aprender?",
    references: 1,
    state: "Aprendendo",
  },
  {
    answer: "Quando o material é apenas relido sem tentativa anterior de recordação.",
    due: "Em 8 dias",
    id: "F–026",
    question: "Quando uma revisão tende a se tornar passiva?",
    references: 0,
    state: "Novo",
  },
];

export const EditorialFlashcard = ({
  card,
  layout,
  onSelect,
  selected,
}: {
  card: PreviewFlashcard;
  layout: "grid" | "list";
  onSelect: () => void;
  selected: boolean;
}) => (
  <article className={cn("archive-flashcard", `is-${layout}`, selected && "is-selected")}>
    <div className="archive-flashcard-utility">
      <button
        aria-label={selected ? `Desmarcar ${card.id}` : `Selecionar ${card.id}`}
        aria-pressed={selected}
        className="archive-check"
        onClick={onSelect}
        type="button"
      >
        {selected && <CheckIcon aria-hidden="true" size={12} weight="bold" />}
      </button>
      <span>{card.id}</span>
      <CardActions />
    </div>
    <div className="archive-flashcard-question">
      <p>Pergunta</p>
      <h2>{card.question}</h2>
    </div>
    <div className="archive-flashcard-answer">
      <p>Resposta</p>
      <div>{card.answer}</div>
    </div>
    <footer className="archive-flashcard-footer">
      <span className={cn("archive-state", `is-${card.state.toLowerCase()}`)}>{card.state}</span>
      {card.references > 0 && (
        <span className="archive-reference-count">
          <LinkSimpleIcon aria-hidden="true" size={14} />
          {card.references} {card.references === 1 ? "referência" : "referências"}
        </span>
      )}
      <strong>{card.due}</strong>
    </footer>
  </article>
);

const CardActions = () => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button aria-label="Ações do flashcard" className="archive-icon-button" type="button">
        <DotsThreeIcon aria-hidden="true" size={18} weight="bold" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="archive-menu">
      <DropdownMenuItem>
        <PencilSimpleIcon aria-hidden="true" /> Editar
      </DropdownMenuItem>
      <DropdownMenuItem>
        <RepeatIcon aria-hidden="true" /> Mover
      </DropdownMenuItem>
      <DropdownMenuItem>
        <ArchiveIcon aria-hidden="true" /> Arquivar
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive">
        <TrashIcon aria-hidden="true" /> Excluir
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export const EditorialPracticeCallout = () => (
  <aside className="archive-practice-note">
    <div>
      <p className="archive-kicker">Sessão de hoje</p>
      <strong>132 fichas pedem sua atenção</strong>
      <span>Estimativa de 18 minutos com base no seu ritmo recente.</span>
    </div>
    <button className="archive-text-action" type="button">
      Continuar prática <ArrowRightIcon aria-hidden="true" size={15} />
    </button>
  </aside>
);
