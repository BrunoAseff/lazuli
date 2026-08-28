import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button.tsx";
import { useDeleteReference } from "../api/reference-queries.ts";

export const ReferenceDeleteButton = ({
  disabled,
  label = "Remover referência",
  onRemoved,
  referenceId,
}: {
  disabled?: boolean;
  label?: string;
  onRemoved?: () => void | Promise<void>;
  referenceId: string;
}) => {
  const [open, setOpen] = useState(false);
  const remove = useDeleteReference();
  return (
    <>
      <Button
        aria-label={label}
        disabled={disabled || remove.isPending}
        onClick={() => setOpen(true)}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Trash2Icon aria-hidden="true" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover referência?</AlertDialogTitle>
            <AlertDialogDescription>
              O material continuará existindo, mas deixará de estar conectado a este documento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={async () => {
                try {
                  await remove.mutateAsync(referenceId);
                  await onRemoved?.();
                  toast.success("Referência removida.");
                } catch {
                  toast.error("Não foi possível remover a referência.");
                }
              }}
              variant="destructive"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
