import { EllipsisIcon, ImageIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { cn } from "@/lib/utils.ts";

type ProjectActionsMenuProps = {
  className?: string;
  onChangeCover: () => void;
  onDelete: () => void;
  onRename: () => void;
};

export const ProjectActionsMenu = ({
  className,
  onChangeCover,
  onDelete,
  onRename,
}: ProjectActionsMenuProps) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <Button
        aria-label="Abrir ações do projeto"
        className={cn("bg-background bg-clip-border shadow-sm", className)}
        size="icon-sm"
        variant="outline"
      >
        <EllipsisIcon aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
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
