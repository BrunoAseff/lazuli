import type { AiMaterialKind } from "@lazuli/shared";
import { FlashcardDomainIcon, QuizDomainIcon } from "@/components/domain-icons.ts";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group.tsx";

export function MaterialKindPicker({
  value,
  onChange,
  label = "O que criar",
}: {
  value: AiMaterialKind;
  onChange: (value: AiMaterialKind) => void;
  label?: string;
}) {
  return (
    <RadioGroup
      className="grid grid-cols-2 gap-3"
      aria-label={label}
      value={value}
      onValueChange={(next) => onChange(next as AiMaterialKind)}
    >
      {(
        [
          ["flashcard", "Flashcards", "Pergunta e resposta", FlashcardDomainIcon],
          ["quizQuestion", "Questões", "Escolha entre alternativas", QuizDomainIcon],
        ] as const
      ).map(([kind, title, description, Icon]) => (
        <RadioCard
          description={description}
          icon={<Icon aria-hidden="true" />}
          key={kind}
          layout="tile"
          title={title}
          value={kind}
        />
      ))}
    </RadioGroup>
  );
}
