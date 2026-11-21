import type { ProjectTreeItem } from "@lazuli/shared";

import { ConfirmationDialog } from "@/components/confirmation-dialog.tsx";

export const ProjectItemDeleteDialog = ({
  item,
  onConfirm,
  onOpenChange,
}: {
  item: ProjectTreeItem | null;
  onConfirm: (item: ProjectTreeItem) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) => {
  const noun = item?.type === "folder" ? "pasta" : "documento";
  return (
    <ConfirmationDialog
      actionLabel={`Excluir ${noun}`}
      description={
        item?.type === "folder"
          ? "Todos os documentos e pastas dentro dela também serão excluídos."
          : "O conteúdo e as imagens deste documento serão excluídos permanentemente."
      }
      destructive
      onConfirm={() => (item ? onConfirm(item) : undefined)}
      onOpenChange={onOpenChange}
      open={Boolean(item)}
      title={`Excluir ${noun}?`}
    />
  );
};
