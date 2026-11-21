import { MagicWandIcon, PlusIcon } from "@/components/icons.tsx";
import type { ComponentType } from "react";

import { Button } from "@/components/ui/button.tsx";

/**
 * The one guide for an empty collection, in the work area: the two ways to start, side by side.
 * The AI one opens the collection's own generation button, so there is one dialog.
 */
export const StudyCollectionStart = ({
  createLabel,
  generateLabel,
  icon: Icon,
  noun,
  onCreate,
}: {
  createLabel: string;
  /** "Gerar flashcards com IA": the same words as the collection's AI button. */
  generateLabel: string;
  icon: ComponentType<{ className?: string }>;
  noun: string;
  onCreate: () => void;
}) => (
  <div className="empty-state flex flex-1 items-center justify-center px-6 text-center">
    <div className="max-w-sm">
      <Icon className="mx-auto mb-3 size-6 text-muted-foreground" />
      <h2 className="font-reading text-xl font-normal">Comece esta coleção</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Escreva {noun} você mesmo ou gere a partir de um documento com IA. Você revisa tudo antes de
        salvar.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button onClick={onCreate}>
          <PlusIcon /> {createLabel}
        </Button>
        <Button
          onClick={() =>
            document.querySelector<HTMLButtonElement>("[data-ai-generation-trigger]")?.click()
          }
          variant="outline"
        >
          <MagicWandIcon /> {generateLabel}
        </Button>
      </div>
    </div>
  </div>
);
