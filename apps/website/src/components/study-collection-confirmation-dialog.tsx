import type { ReactNode } from "react";

import { ConfirmationDialog } from "@/components/confirmation-dialog.tsx";

export const StudyCollectionConfirmationDialog = ({
  description,
  mode,
  onConfirm,
  onOpenChange,
  open,
  pending,
  title,
}: {
  description: ReactNode;
  mode: "archive" | "delete";
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
  title: string;
}) => {
  const deleting = mode === "delete";
  const action = deleting ? "Excluir" : "Arquivar";

  return (
    <ConfirmationDialog
      actionLabel={`${action} coleção`}
      description={description}
      destructive={deleting}
      pending={pending}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      title={title}
    />
  );
};
