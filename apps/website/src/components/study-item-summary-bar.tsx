import type { StudyCollectionStatus } from "@lazuli/shared";
import { ArchiveIcon, ArchiveRestoreIcon, MoveRightIcon, Trash2Icon } from "@/components/icons.tsx";

import { Button } from "@/components/ui/button.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";

const BatchAction = ({
  children,
  label,
  onClick,
  destructive = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        aria-label={label}
        className={
          destructive
            ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
            : undefined
        }
        onClick={onClick}
        size="icon-sm"
        variant="ghost"
      >
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

/** Contents of the selection row; StudyIndexTools owns its place and transition. */
export const StudyItemSummaryBar = ({
  count,
  itemLabel,
  onClear,
  onDelete,
  onMove,
  onToggleArchive,
  status,
}: {
  count: number;
  itemLabel: { plural: string; singular: string };
  onClear: () => void;
  onDelete: () => void;
  onMove?: () => void;
  onToggleArchive: () => void;
  status: StudyCollectionStatus;
}) => (
  <>
    <span className="min-w-0 truncate">
      <span className="tabular-nums">{count}</span>{" "}
      {count === 1 ? itemLabel.singular : itemLabel.plural}
    </span>
    <Button className="mr-auto text-muted-foreground" onClick={onClear} size="xs" variant="ghost">
      Desmarcar
    </Button>
    {onMove && (
      <BatchAction label="Mover selecionados" onClick={onMove}>
        <MoveRightIcon />
      </BatchAction>
    )}
    <BatchAction
      label={status === "active" ? "Arquivar selecionados" : "Restaurar selecionados"}
      onClick={onToggleArchive}
    >
      {status === "active" ? <ArchiveIcon /> : <ArchiveRestoreIcon />}
    </BatchAction>
    <BatchAction destructive label="Excluir selecionados" onClick={onDelete}>
      <Trash2Icon />
    </BatchAction>
  </>
);
