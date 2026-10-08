import { PlayIcon } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import { cn } from "@/lib/utils.ts";

type FlashcardPracticeButtonProps = {
  archived?: boolean;
  className?: string;
  dueCards: number;
  onClick: () => void;
  size?: "sm" | "lg";
  title: string;
  totalCards: number;
};

const getDisabledReason = ({
  archived,
  dueCards,
  totalCards,
}: Pick<FlashcardPracticeButtonProps, "archived" | "dueCards" | "totalCards">) => {
  if (archived) return "Restaure a coleção antes de praticar.";
  if (totalCards === 0) return "Adicione um flashcard à coleção antes de praticar.";
  if (dueCards === 0) return "Nenhum flashcard está disponível para revisão agora.";
  return null;
};

export const FlashcardPracticeButton = ({
  archived = false,
  className,
  dueCards,
  onClick,
  size = "sm",
  title,
  totalCards,
}: FlashcardPracticeButtonProps) => {
  const disabledReason = getDisabledReason({ archived, dueCards, totalCards });
  const button = (
    <Button
      aria-label={`Praticar ${title}`}
      className={cn("w-full sm:w-auto", className)}
      disabled={Boolean(disabledReason)}
      onClick={onClick}
      size={size}
    >
      <PlayIcon aria-hidden="true" className="-translate-y-px" />
      Praticar
    </Button>
  );

  if (!disabledReason) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex w-full sm:w-auto" tabIndex={0}>
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{disabledReason}</TooltipContent>
    </Tooltip>
  );
};
