import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  EllipsisIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import type { FavoriteTarget } from "@lazuli/shared";
import { FavoriteMenuItem } from "@/features/favorites/favorite-menu-item.tsx";

import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";

export const StudyCollectionActions = ({
  archived,
  onArchive,
  onDelete,
  onEdit,
  onRestore,
  title,
  favoriteTarget,
}: {
  archived: boolean;
  onArchive: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onRestore: () => void;
  title: string;
  favoriteTarget: FavoriteTarget;
}) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <Button
        aria-label={`Ações de ${title}`}
        className="max-sm:size-11"
        size="icon"
        variant="ghost"
      >
        <EllipsisIcon aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <FavoriteMenuItem target={favoriteTarget} />
      <DropdownMenuItem onSelect={onEdit}>
        <PencilIcon aria-hidden="true" />
        Renomear e organizar
      </DropdownMenuItem>
      {archived ? (
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
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onDelete} variant="destructive">
        <Trash2Icon aria-hidden="true" />
        Excluir
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
