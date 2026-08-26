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
}: {
  archived: boolean;
  onArchive: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onRestore: () => void;
  title: string;
}) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <Button aria-label={`Ações de ${title}`} size="icon-sm" variant="ghost">
        <EllipsisIcon aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
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
