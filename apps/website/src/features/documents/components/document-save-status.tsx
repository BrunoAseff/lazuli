import { CircleAlertIcon, CloudCheckIcon, CloudUploadIcon, LoaderCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";

export type DocumentSaveState = "saved" | "pending" | "saving" | "error" | "conflict";

export const DocumentSaveStatus = ({
  onOpenConflict,
  onRetry,
  state,
}: {
  onOpenConflict: () => void;
  onRetry: () => void;
  state: DocumentSaveState;
}) => {
  if (state === "saved")
    return (
      <span className="flex h-9 items-center gap-2 text-sm text-muted-foreground" role="status">
        <CloudCheckIcon className="size-4 text-success" />
        <span className="sr-only sm:not-sr-only">Alterações salvas</span>
      </span>
    );
  if (state === "saving")
    return (
      <span className="flex h-9 items-center gap-2 text-sm text-muted-foreground" role="status">
        <LoaderCircleIcon className="size-4 animate-spin" />
        <span className="sr-only sm:not-sr-only">Salvando…</span>
      </span>
    );
  if (state === "pending")
    return (
      <span className="flex h-9 items-center gap-2 text-sm text-muted-foreground" role="status">
        <CloudUploadIcon className="size-4" />
        <span className="sr-only sm:not-sr-only">Alterações não salvas</span>
      </span>
    );
  return (
    <Button
      className="h-9"
      onClick={state === "conflict" ? onOpenConflict : onRetry}
      size="sm"
      variant="ghost"
    >
      <CircleAlertIcon className="text-destructive" />
      {state === "conflict" ? "Conflito de edição" : "Erro ao salvar · Tentar novamente"}
    </Button>
  );
};
