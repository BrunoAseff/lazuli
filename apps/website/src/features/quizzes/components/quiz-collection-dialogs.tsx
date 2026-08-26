import type {
  CreateQuizCollectionInput,
  QuizCollectionSummary,
  UpdateQuizCollectionInput,
} from "@lazuli/shared";
import { AlertTriangleIcon, ArchiveIcon } from "lucide-react";
import { toast } from "sonner";

import { StudyCollectionDialog } from "@/components/study-collection-dialog.tsx";
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
import { Spinner } from "@/components/ui/spinner.tsx";
import {
  useCreateQuizCollection,
  useDeleteQuizCollection,
  useUpdateQuizCollection,
} from "../api/quiz-collection-queries.ts";
import { getQuizCollectionErrorMessage } from "../quiz-messages.ts";

export const QuizCollectionDialog = ({
  collection,
  onOpenChange,
  open,
}: {
  collection?: QuizCollectionSummary;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const create = useCreateQuizCollection();
  const update = useUpdateQuizCollection(collection?.id ?? "");
  const mutation = collection ? update : create;

  return (
    <StudyCollectionDialog
      collection={collection}
      createDescription="Agrupe questões relacionadas a um mesmo assunto."
      onOpenChange={onOpenChange}
      onReset={() => mutation.reset()}
      onSubmit={async (input) => {
        try {
          if ("id" in input) {
            await create.mutateAsync(input as CreateQuizCollectionInput);
            toast.success("Coleção criada.");
          } else {
            await update.mutateAsync(input as UpdateQuizCollectionInput);
            toast.success("Coleção atualizada.");
          }
        } catch (error) {
          toast.error(
            getQuizCollectionErrorMessage(
              error,
              collection
                ? "Não foi possível atualizar a coleção."
                : "Não foi possível criar a coleção.",
            ),
          );
          throw error;
        }
      }}
      open={open}
      pending={mutation.isPending}
      placeholder="Ex.: História da arte"
    />
  );
};

export const ArchiveQuizCollectionDialog = ({
  collection,
  onOpenChange,
  open,
}: {
  collection: QuizCollectionSummary;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const mutation = useUpdateQuizCollection(collection.id);
  const archive = async () => {
    try {
      await mutation.mutateAsync({ archived: true });
      toast.success("Coleção arquivada.");
      onOpenChange(false);
    } catch (error) {
      toast.error(getQuizCollectionErrorMessage(error, "Não foi possível arquivar a coleção."));
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <ArchiveIcon aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>Arquivar “{collection.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Suas {collection.totalQuestions}{" "}
            {collection.totalQuestions === 1
              ? "questão será preservada"
              : "questões serão preservadas"}
            . Você poderá restaurar a coleção depois.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              void archive();
            }}
          >
            {mutation.isPending && <Spinner />}
            {mutation.isPending ? "Arquivando..." : "Arquivar coleção"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const DeleteQuizCollectionDialog = ({
  collection,
  onDeleted,
  onOpenChange,
  open,
}: {
  collection: QuizCollectionSummary;
  onDeleted: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const mutation = useDeleteQuizCollection(collection.id);
  const remove = async () => {
    try {
      await mutation.mutateAsync();
      toast.success("Coleção excluída.");
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      toast.error(getQuizCollectionErrorMessage(error, "Não foi possível excluir a coleção."));
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <AlertTriangleIcon aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>Excluir “{collection.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {collection.totalQuestions === 0
              ? "A coleção ainda não possui questões."
              : `${collection.totalQuestions} ${collection.totalQuestions === 1 ? "questão será excluída" : "questões serão excluídas"}.`}{" "}
            {collection.totalAttempts > 0
              ? `O histórico de ${collection.totalAttempts} ${collection.totalAttempts === 1 ? "tentativa também será excluído" : "tentativas também será excluído"}. `
              : ""}
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              void remove();
            }}
            variant="destructive"
          >
            {mutation.isPending && <Spinner />}
            {mutation.isPending ? "Excluindo..." : "Excluir coleção"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
