import type { FlashcardCollectionSummary } from "@lazuli/shared";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  EllipsisIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";

export const FlashcardCollectionActions = ({
  collection,
  onArchive,
  onDelete,
  onEdit,
  onRestore,
}: {
  collection: FlashcardCollectionSummary;
  onArchive: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onRestore: () => void;
}) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <Button aria-label={`Ações de ${collection.title}`} size="icon-sm" variant="ghost">
        <EllipsisIcon aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      <DropdownMenuItem onSelect={onEdit}>
        <PencilIcon aria-hidden="true" />
        Renomear e organizar
      </DropdownMenuItem>
      {collection.archivedAt ? (
        <DropdownMenuItem onSelect={onRestore}>
          <ArchiveRestoreIcon aria-hidden="true" />
          Restaurar
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem onSelect={onArchive}>
          <ArchiveIcon aria-hidden="true" />
          Arquivar
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onSelect={onDelete} variant="destructive">
        <Trash2Icon aria-hidden="true" />
        Excluir
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
