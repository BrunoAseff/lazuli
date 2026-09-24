import { AlertTriangleIcon, ArchiveIcon } from "lucide-react";
import type { ReactNode } from "react";

import { ConfirmationDialog } from "@/components/confirmation-dialog.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";

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
  const pendingAction = deleting ? "Excluindo..." : "Arquivando...";

  return (
    <ConfirmationDialog
      actionLabel={
        <>
          {pending && <Spinner />}
          {pending ? pendingAction : `${action} coleção`}
        </>
      }
      description={description}
      destructive={deleting}
      disabled={pending}
      media={
        deleting ? <AlertTriangleIcon aria-hidden="true" /> : <ArchiveIcon aria-hidden="true" />
      }
      mediaClassName={deleting ? "bg-destructive/10 text-destructive" : undefined}
      onConfirm={onConfirm}
      onOpenChange={(next) => !pending && onOpenChange(next)}
      open={open}
      title={title}
    />
  );
};
