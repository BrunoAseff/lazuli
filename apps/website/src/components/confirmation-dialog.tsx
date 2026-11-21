import { useState, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";

export const ConfirmationDialog = ({
  actionLabel,
  children,
  cancelLabel = "Cancelar",
  description,
  destructive = false,
  disabled = false,
  onConfirm,
  onOpenChange,
  open,
  pending = false,
  title,
}: {
  actionLabel: ReactNode;
  children?: ReactNode;
  cancelLabel?: string;
  description: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** The action runs outside `onConfirm`'s promise (a mutation fired and left). */
  pending?: boolean;
  title: ReactNode;
}) => {
  // While the confirmed action runs, its button says so ("Excluindo") and the dialog stays open.
  const [running, setRunning] = useState(false);
  const busy = running || pending;
  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogContent>
        {/* No icon on top: the title and the action's label name what happens. */}
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <Button
            disabled={disabled}
            onClick={async () => {
              setRunning(true);
              try {
                await onConfirm();
              } finally {
                setRunning(false);
              }
            }}
            pending={busy}
            variant={destructive ? "destructive" : "default"}
          >
            {actionLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
