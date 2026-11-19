import { XIcon } from "@/components/icons.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
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
  label = "Desconectar fonte",
  onRemoved,
  referenceId,
}: {
  disabled?: boolean;
  label?: string;
  onRemoved?: () => void | Promise<void>;
  referenceId: string;
}) => {
  const remove = useDeleteReference();
  return (
    <ConfirmReferenceRemovalButton
      disabled={disabled || remove.isPending}
      label={label}
      onConfirm={async () => {
        try {
          await remove.mutateAsync(referenceId);
          await onRemoved?.();
          toast.success("Fonte desconectada.");
        } catch {
          toast.error("Não foi possível desconectar a fonte.");
        }
      }}
    />
  );
};

export const ConfirmReferenceRemovalButton = ({
  disabled,
  label = "Desconectar fonte",
  onConfirm,
}: {
  disabled?: boolean;
  label?: string;
  onConfirm: () => void | Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Disconnecting keeps the material, so the mark is "remove from this list", not a trash can. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={label}
            disabled={disabled}
            onClick={() => setOpen(true)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <XIcon aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Desconectar</TooltipContent>
      </Tooltip>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar fonte?</AlertDialogTitle>
            <AlertDialogDescription>
              O material continuará existindo, mas deixará de estar conectado a este documento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={disabled}
              onClick={async () => {
                await onConfirm();
                setOpen(false);
              }}
              variant="destructive"
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
