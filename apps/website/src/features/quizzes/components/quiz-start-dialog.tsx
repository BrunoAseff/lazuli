import { useNavigate } from "react-router";
import { toast } from "sonner";

import { RotateCcwIcon } from "@/components/icons.tsx";
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
  const begin = async (abandonActive = false) => {
    if (active && !abandonActive)
      return void navigate(`/quizzes/${collectionId}/attempts/${active.id}`);
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
              disabled={start.isPending}
              onClick={() => void begin(true)}
              variant="ghost"
            >
              <RotateCcwIcon aria-hidden="true" /> Recomeçar
            </Button>
          )}
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={start.isPending || availability.isPending}
            onClick={() => void begin(false)}
          >
            {active ? "Continuar" : "Iniciar quiz"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
