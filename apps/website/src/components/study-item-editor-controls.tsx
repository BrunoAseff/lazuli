import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  MoveRightIcon,
  Trash2Icon,
  CopyIcon,
  MagicWandIcon,
  SlidersHorizontalIcon,
} from "@/components/icons.tsx";

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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import type { StudyItemAction } from "@/lib/study-actions.ts";

export const StudyDetailsButton = ({ onClick }: { onClick: () => void }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        aria-label="Detalhes"
        className="px-2.5 sm:px-3 @min-[960px]/study-workspace:hidden"
        onClick={onClick}
        variant="outline"
      >
        <SlidersHorizontalIcon aria-hidden="true" />
        <span className="hidden sm:inline">Detalhes</span>
      </Button>
    </TooltipTrigger>
    <TooltipContent>Detalhes</TooltipContent>
  </Tooltip>
);

export function StudyRefineAction({
  disabled,
  onImprove,
}: {
  disabled: boolean;
  onImprove: () => void;
}) {
  return (
    <Button aria-label="Refinar com IA" variant="outline" disabled={disabled} onClick={onImprove}>
      <MagicWandIcon />
      <span>
        Refinar <span className="hidden sm:inline">com IA</span>
      </span>
    </Button>
  );
}

export const StudyItemActionsPanel = ({
  archived,
  canMove = false,
  canDuplicate = false,
  onAction,
}: {
  archived: boolean;
  canMove?: boolean;
  canDuplicate?: boolean;
  onAction: (action: StudyItemAction) => void;
}) => (
  <section className="pt-4">
    <p className="mb-3 text-xs font-medium text-muted-foreground">Ações</p>
    <div className="grid gap-1">
      {canDuplicate && (
        <Button className="h-9 justify-start" variant="ghost" onClick={() => onAction("duplicate")}>
          <CopyIcon /> Duplicar material
        </Button>
      )}
      {canMove && !archived && (
        <Button className="h-9 justify-start" onClick={() => onAction("move")} variant="ghost">
          <MoveRightIcon /> Mover
        </Button>
      )}
      <Button
        className="h-9 justify-start"
        onClick={() => onAction(archived ? "restore" : "archive")}
        variant="ghost"
      >
        {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
        {archived ? "Restaurar" : "Arquivar"}
      </Button>
      <Button
        className="h-9 justify-start text-destructive hover:text-destructive"
        onClick={() => onAction("delete")}
        variant="ghost"
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
}) => {
  const aside = useRef<HTMLElement>(null);
  const [inline, setInline] = useState(false);
  useEffect(() => {
    const node = aside.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setInline((entry?.contentRect.width ?? 0) > 0),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <Sheet open={open && !inline} onOpenChange={onOpenChange}>
        <SheetContent className="w-[min(24rem,calc(100vw-1rem))] overflow-y-auto p-0 lazuli-thin-scrollbar">
          <SheetHeader className="border-b px-5 py-5">
            <SheetTitle>Organização</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="study-details px-5 pb-6">{!inline && children}</div>
        </SheetContent>
      </Sheet>
      <aside
        ref={aside}
        className="study-details hidden min-h-0 overflow-y-auto bg-background px-4 py-5 lazuli-thin-scrollbar @min-[960px]/study-workspace:block"
      >
        <h2 className="mb-6 text-sm font-semibold">Organização</h2>
        {inline && children}
      </aside>
    </>
  );
};
