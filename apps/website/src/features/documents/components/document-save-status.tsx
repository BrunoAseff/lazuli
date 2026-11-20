import {
  CircleAlertIcon,
  CloudCheckIcon,
  CloudUploadIcon,
  LoaderCircleIcon,
} from "@/components/icons.tsx";

import { Button } from "@/components/ui/button.tsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

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
  const reduced = useReducedMotion();
  const labels = {
    saved: "Alterações salvas",
    saving: "Salvando…",
    pending: "Alterações não salvas",
    error: "Erro ao salvar · Tentar novamente",
    conflict: "Conflito de edição",
  };
  const Icon =
    state === "saved" ? CloudCheckIcon : state === "saving" ? LoaderCircleIcon : CloudUploadIcon;
  const content =
    state === "saved" || state === "saving" || state === "pending" ? (
      <>
        <Icon
          aria-hidden="true"
          className={`size-4 shrink-0 ${state === "saved" ? "text-success" : state === "saving" ? "animate-spin motion-reduce:animate-none" : ""}`}
        />
        <span className="sr-only sm:not-sr-only">{labels[state]}</span>
      </>
    ) : (
      <Button
        aria-label={labels[state]}
        className="h-8 w-full justify-start px-0 text-xs"
        onClick={state === "conflict" ? onOpenConflict : onRetry}
        size="sm"
        variant="ghost"
      >
        <CircleAlertIcon className="text-destructive" />
        <span className="sr-only sm:not-sr-only">
          {state === "conflict" ? "Conflito de edição" : "Tentar salvar"}
        </span>
      </Button>
    );
  return (
    <div
      className="relative h-8 w-8 shrink-0 text-xs text-muted-foreground sm:w-44"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={state}
          className="absolute inset-0 flex items-center gap-2 whitespace-nowrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.12 }}
        >
          {content}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};
