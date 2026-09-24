import type { ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";

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
  title: ReactNode;
}) => (
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
        <AlertDialogAction
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();
            void onConfirm();
          }}
          variant={destructive ? "destructive" : "default"}
        >
          {actionLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
