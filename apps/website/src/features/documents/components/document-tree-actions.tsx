import type { ProjectTreeItem } from "@lazuli/shared";
import { FilePlus2Icon, FolderPlusIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu.tsx";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu.tsx";

export const DocumentTreeActions = ({
  context = false,
  item,
  onCreate,
  onDelete,
  onRename,
}: {
  context?: boolean;
  item: ProjectTreeItem;
  onCreate: (type: "folder" | "document") => void;
  onDelete: () => void;
  onRename: () => void;
}) => {
  const Item = context ? ContextMenuItem : DropdownMenuItem;
  const Separator = context ? ContextMenuSeparator : DropdownMenuSeparator;
  return (
    <>
      <Item onSelect={onRename}>
        <PencilIcon /> Renomear
      </Item>
      {item.type === "folder" && (
        <>
          <Item className="whitespace-nowrap" onSelect={() => onCreate("document")}>
            <FilePlus2Icon /> Novo documento
          </Item>
          <Item className="whitespace-nowrap" onSelect={() => onCreate("folder")}>
            <FolderPlusIcon /> Nova pasta
          </Item>
        </>
      )}
      <Separator />
      <Item variant="destructive" onSelect={onDelete}>
        <Trash2Icon /> Excluir
      </Item>
    </>
  );
};
