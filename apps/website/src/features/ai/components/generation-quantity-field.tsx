import { AI_COLLECTION_MAX_ITEMS, type AiMaterialKind } from "@lazuli/shared";

import { QuantitySelector } from "@/components/quantity-selector.tsx";
import { Label } from "@/components/ui/label.tsx";

const options = Array.from({ length: AI_COLLECTION_MAX_ITEMS }, (_, index) => index + 1);

/** One proposal per ~300 words, between 1 and the most a generation makes. */
export const suggestedQuantity = (words: number) =>
  Math.max(1, Math.min(AI_COLLECTION_MAX_ITEMS, Math.round(words / 300)));

export const wordsIn = (text: string) => text.match(/\S+/g)?.length ?? 0;

/**
 * "Quantos?" in every generation dialog: the same range, and the same suggestion from the size of
 * what the AI will read.
 */
export const GenerationQuantityField = ({
  kind,
  label = "Quantidade de propostas",
  onChange,
  value,
  words,
}: {
  kind: AiMaterialKind;
  label?: string;
  onChange: (value: number) => void;
  value: number;
  words?: number;
}) => {
  const suggestion = suggestedQuantity(words ?? 0);
  return (
    <div className="grid gap-2">
      <Label asChild>
        <p>{kind === "flashcard" ? "Quantos?" : "Quantas?"}</p>
      </Label>
      <QuantitySelector label={label} onChange={onChange} options={options} value={value} />
      {words ? (
        <p className="text-xs text-muted-foreground">
          {suggestion} {suggestion === 1 ? "sugerido" : "sugeridos"} para cerca de{" "}
          {words.toLocaleString("pt-BR")} palavras. Depois de revisar, dá para gerar mais.
        </p>
      ) : null}
    </div>
  );
};
