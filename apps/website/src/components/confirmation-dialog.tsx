import { useState, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
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
  media,
  mediaClassName,
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
  media?: ReactNode;
  mediaClassName?: string;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** The action runs outside `onConfirm`'s promise (a mutation fired and left). */
  pending?: boolean;
  title: ReactNode;
}) => {
  // While the confirmed action runs, its button says so ("Excluindo") instead of greying out.
  const [running, setRunning] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {media && <AlertDialogMedia className={mediaClassName}>{media}</AlertDialogMedia>}
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
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
            pending={running || pending}
            variant={destructive ? "destructive" : "default"}
          >
            {actionLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
