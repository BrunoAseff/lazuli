import { ArchiveIcon, ArchiveRestoreIcon, MoveRightIcon, Trash2Icon } from "lucide-react";

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
import type { ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import type { StudyItemAction } from "@/lib/study-actions.ts";
import { cn } from "@/lib/utils.ts";

export const StudyItemActionsPanel = ({
  archived,
  canMove = false,
  onAction,
}: {
  archived: boolean;
  canMove?: boolean;
  onAction: (action: StudyItemAction) => void;
}) => (
  <section className="border-t pt-6">
    <p className="mb-3 text-[0.6875rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
      Ações
    </p>
    <div className="grid grid-cols-2 gap-2">
      {canMove && !archived && (
        <Button className="h-9 justify-start" onClick={() => onAction("move")} variant="outline">
          <MoveRightIcon /> Mover
        </Button>
      )}
      <Button
        className={cn("h-9 justify-start", (!canMove || archived) && "col-span-2")}
        onClick={() => onAction(archived ? "restore" : "archive")}
        variant="outline"
      >
        {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
        {archived ? "Restaurar" : "Arquivar"}
      </Button>
      <Button
        className="col-span-2 h-9 justify-start text-destructive hover:text-destructive"
        onClick={() => onAction("delete")}
        variant="outline"
      >
        <Trash2Icon /> Excluir
      </Button>
    </div>
  </section>
);

export const DiscardStudyItemChangesDialog = ({
  description,
  onDiscard,
  onOpenChange,
  open,
}: {
  description: string;
  onDiscard: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Continuar editando</AlertDialogCancel>
        <AlertDialogAction onClick={onDiscard} variant="destructive">
          Descartar
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export const StudyItemDetails = ({
  children,
  description,
  onOpenChange,
  open,
}: {
  children: ReactNode;
  description: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => (
  <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(24rem,calc(100vw-1rem))] overflow-y-auto p-0 lazuli-thin-scrollbar">
        <SheetHeader className="border-b px-5 py-5">
          <SheetTitle>Detalhes</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="px-5 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
    <aside className="hidden min-h-0 overflow-y-auto border-l bg-background px-5 py-5 lazuli-thin-scrollbar xl:block">
      <h2 className="mb-6 font-heading text-xl font-normal">Detalhes</h2>
      {children}
    </aside>
  </>
);
