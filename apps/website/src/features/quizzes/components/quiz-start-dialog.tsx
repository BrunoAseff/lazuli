import { useNavigate } from "react-router";
import { toast } from "sonner";

import { RotateCcwIcon } from "@/components/icons.tsx";
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
import { useCreateQuizAttempt, useQuizAttemptAvailability } from "../api/quiz-queries.ts";

/**
 * Starting (or resuming) a quiz, wherever it is offered. It opens over the current page, so
 * starting from a list never passes through the editor, where the answers are visible.
 */
export const QuizStartDialog = ({
  collectionId,
  onOpenChange,
  open,
}: {
  collectionId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const navigate = useNavigate();
  const availability = useQuizAttemptAvailability(collectionId);
  const start = useCreateQuizAttempt(collectionId);
  const active = availability.data?.activeAttempt;
  const total = availability.data?.totalQuestions ?? 0;
  // Which of the two buttons started the attempt, so only that one says it is working.
  const restarting = Boolean(start.variables?.abandonActive);
  const begin = async (abandonActive = false) => {
    if (active && !abandonActive) {
      onOpenChange(false);
      return void navigate(`/quizzes/${collectionId}/attempts/${active.id}`);
    }
    try {
      const attempt = await start.mutateAsync({ id: crypto.randomUUID(), abandonActive });
      onOpenChange(false);
      await navigate(`/quizzes/${collectionId}/attempts/${attempt.id}`);
    } catch {
      toast.error("Não foi possível iniciar o quiz.");
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{active ? "Tentativa em andamento" : "Iniciar quiz?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {active
              ? "Continue de onde parou ou abandone as respostas atuais e comece novamente."
              : `O quiz tem ${total} ${total === 1 ? "questão" : "questões"}. A correção aparece após a conclusão.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {/* Same anatomy as other dialogs: the destructive choice apart on the left, the way forward on the right. */}
        <AlertDialogFooter>
          {active && (
            <Button
              className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
              onClick={() => void begin(true)}
              pending={start.isPending && restarting}
              variant="ghost"
            >
              <RotateCcwIcon aria-hidden="true" /> Recomeçar
            </Button>
          )}
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            disabled={availability.isPending || (start.isPending && restarting)}
            onClick={() => void begin(false)}
            pending={start.isPending && !restarting}
            pendingLabel={active ? "Abrindo" : "Iniciando"}
          >
            {active ? "Continuar" : "Iniciar quiz"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
