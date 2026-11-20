import type { FlashcardSummary } from "@lazuli/shared";

import { HighlightText } from "@/components/highlight-text.tsx";
import { StudyIndexList, StudyIndexRow } from "@/components/study-index.tsx";
import { formatMediumDate } from "@/lib/date-format.ts";

type MemoryState = "archived" | "new" | "learning" | "due" | "consolidated";

const memoryState = (card: FlashcardSummary, now: Date): MemoryState => {
  if (card.archivedAt) return "archived";
  if (card.srsState === "new") return "new";
  if (card.lastReviewedAt && new Date(card.dueAt) <= now) return "due";
  if (card.srsState === "review") return "consolidated";
  return "learning";
};

const memoryLabel = (card: FlashcardSummary, state: MemoryState) => {
  if (state === "archived") return "Arquivado";
  if (state === "new") return "Novo";
  if (state === "due") return "Revisar agora";
  const prefix = state === "learning" ? "Aprendendo" : "Próxima revisão";
  return `${prefix} · ${formatMediumDate(new Date(card.dueAt))}`;
};

/** A ring that fills as the card moves from new to consolidated; lapis marks what is due now. */
export const FlashcardMemoryMark = ({ state }: { state: MemoryState }) => (
  <svg className="flashcard-memory-mark" data-state={state} viewBox="0 0 12 12">
    <circle cx="6" cy="6" r="4.25" />
    {state === "learning" && <path d="M6 1.75a4.25 4.25 0 0 0 0 8.5Z" />}
  </svg>
);

/** The editor states the card's memory with the same glyph and words as the index. */
export const FlashcardMemoryStatus = ({ card }: { card: FlashcardSummary }) => {
  const state = memoryState(card, new Date());
  return (
    <p className="flex items-center gap-2 text-sm">
      <FlashcardMemoryMark state={state} />
      <span className="flashcard-memory-label text-muted-foreground" data-state={state}>
        {memoryLabel(card, state)}
      </span>
    </p>
  );
};

/** The same glyphs in the "Mostrar" filter act as their legend. */
export const NewMemoryMark = () => <FlashcardMemoryMark state="new" />;
export const DueMemoryMark = () => <FlashcardMemoryMark state="due" />;
export const ScheduledMemoryMark = () => <FlashcardMemoryMark state="consolidated" />;

export const FlashcardIndex = ({
  activeId,
  cards,
  onOpen,
  onSelect,
  query,
  selected,
}: {
  activeId?: string;
  cards: FlashcardSummary[];
  onOpen: (card: FlashcardSummary) => void;
  onSelect: (cardId: string, selected: boolean) => void;
  query: string;
  selected: Set<string>;
}) => {
  const now = new Date();
  return (
    <StudyIndexList label="Flashcards da coleção" selecting={selected.size > 0}>
      {cards.map((card) => {
        const state = memoryState(card, now);
        const text = card.questionText.trim();
        return (
          <StudyIndexRow
            active={activeId === card.id}
            key={card.id}
            mark={<FlashcardMemoryMark state={state} />}
            meta={
              <span className="flashcard-memory-label" data-state={state}>
                {memoryLabel(card, state)}
              </span>
            }
            onOpen={() => onOpen(card)}
            onSelect={(value) => onSelect(card.id, value)}
            selectLabel={`Selecionar flashcard: ${text || "pergunta com imagem"}`}
            selected={selected.has(card.id)}
            title={
              text ? (
                <HighlightText query={query} text={text} />
              ) : (
                <span className="text-muted-foreground italic">Pergunta com imagem</span>
              )
            }
            titleText={text || undefined}
          />
        );
      })}
    </StudyIndexList>
  );
};
