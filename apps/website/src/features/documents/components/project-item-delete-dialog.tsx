import type { ProjectTreeItem } from "@lazuli/shared";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";

export const ProjectItemDeleteDialog = ({
  item,
  onConfirm,
  onOpenChange,
}: {
  item: ProjectTreeItem | null;
  onConfirm: (item: ProjectTreeItem) => void;
  onOpenChange: (open: boolean) => void;
}) => (
  <AlertDialog onOpenChange={onOpenChange} open={Boolean(item)}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          Excluir {item?.type === "folder" ? "pasta" : "documento"}?
        </AlertDialogTitle>
        <AlertDialogDescription>
          {item?.type === "folder"
            ? "Todos os documentos e pastas dentro dela também serão excluídos."
            : "O conteúdo e as imagens deste documento serão excluídos permanentemente."}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancelar</AlertDialogCancel>
        <AlertDialogAction variant="destructive" onClick={() => item && onConfirm(item)}>
          Excluir
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
