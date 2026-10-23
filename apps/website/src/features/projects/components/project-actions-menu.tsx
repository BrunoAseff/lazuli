import { EllipsisIcon, ImageIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import type { FavoriteTarget } from "@lazuli/shared";
import { FavoriteMenuItem } from "@/features/favorites/favorite-menu-item.tsx";

type ProjectActionsMenuProps = {
  className?: string;
  favorite?: FavoriteTarget;
  onChangeCover: () => void;
  onDelete: () => void;
  onRename: () => void;
};

export const ProjectActionsMenu = ({
  className,
  favorite,
  onChangeCover,
  onDelete,
  onRename,
}: ProjectActionsMenuProps) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <Button aria-label="Abrir ações do projeto" className={className} size="icon" variant="ghost">
        <EllipsisIcon aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {favorite && <FavoriteMenuItem target={favorite} />}
      <DropdownMenuItem onSelect={onRename}>
        <PencilIcon aria-hidden="true" />
        Renomear
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onChangeCover}>
        <ImageIcon aria-hidden="true" />
        Alterar capa
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onDelete} variant="destructive">
        <Trash2Icon aria-hidden="true" />
        Excluir
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
