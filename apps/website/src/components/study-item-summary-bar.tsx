import { ArchiveIcon, ArchiveRestoreIcon, MoveRightIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button.tsx";

export const StudyItemSummaryBar = ({
  children,
  count,
  itemLabel,
  onClear,
  onDelete,
  onMove,
  onToggleArchive,
  status,
}: {
  children: ReactNode;
  count: number;
  itemLabel: { plural: string; singular: string };
  onClear: () => void;
  onDelete: () => void;
  onMove?: () => void;
  onToggleArchive: () => void;
  status: "active" | "archived";
}) => (
  <div
    className={`flex min-h-14 shrink-0 items-center border-y py-2 text-xs text-muted-foreground ${count ? "px-3" : "px-5"}`}
  >
    {count ? (
      <div className="flex w-full min-w-0 items-center gap-1">
        <span className="mr-auto truncate text-foreground">
          {count} {count === 1 ? itemLabel.singular : itemLabel.plural}
        </span>
        <Button onClick={onClear} size="xs" variant="ghost">
          Desmarcar
        </Button>
        {onMove && (
          <Button aria-label="Mover selecionados" onClick={onMove} size="icon-sm" variant="outline">
            <MoveRightIcon />
          </Button>
        )}
        <Button
          aria-label={status === "active" ? "Arquivar selecionados" : "Restaurar selecionados"}
          onClick={onToggleArchive}
          size="icon-sm"
          variant="outline"
        >
          {status === "active" ? <ArchiveIcon /> : <ArchiveRestoreIcon />}
        </Button>
        <Button
          aria-label="Excluir selecionados"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          size="icon-sm"
          variant="outline"
        >
          <Trash2Icon />
        </Button>
      </div>
    ) : (
      <div className="grid min-w-0 flex-1 grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-4 gap-y-1">
        {children}
      </div>
    )}
  </div>
);
