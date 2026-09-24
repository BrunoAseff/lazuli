import type {
  CreateFlashcardCollectionInput,
  FlashcardCollectionSummary,
  UpdateFlashcardCollectionInput,
} from "@lazuli/shared";
import { AlertTriangleIcon, ArchiveIcon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmationDialog } from "@/components/confirmation-dialog.tsx";
import { StudyCollectionDialog } from "@/components/study-collection-dialog.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import {
  useCreateFlashcardCollection,
  useDeleteFlashcardCollection,
  useUpdateFlashcardCollection,
} from "../api/flashcard-collection-queries.ts";
import { getFlashcardCollectionErrorMessage } from "../flashcard-messages.ts";

export const FlashcardCollectionDialog = ({
  collection,
  onOpenChange,
  open,
}: {
  collection?: FlashcardCollectionSummary;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const create = useCreateFlashcardCollection();
  const update = useUpdateFlashcardCollection(collection?.id ?? "");
  const mutation = collection ? update : create;

  return (
    <StudyCollectionDialog
      collection={collection}
      createDescription="Agrupe flashcards relacionados a um mesmo assunto."
      onOpenChange={onOpenChange}
      onReset={() => mutation.reset()}
      onSubmit={async (input) => {
        try {
          if ("id" in input) {
            await create.mutateAsync(input as CreateFlashcardCollectionInput);
            toast.success("Coleção criada.");
          } else {
            await update.mutateAsync(input as UpdateFlashcardCollectionInput);
            toast.success("Coleção atualizada.");
          }
        } catch (error) {
          toast.error(
            getFlashcardCollectionErrorMessage(
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
      placeholder="Ex.: Anatomia cardiovascular"
    />
  );
};

export const ArchiveFlashcardCollectionDialog = ({
  collection,
  onOpenChange,
  open,
}: {
  collection: FlashcardCollectionSummary;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const mutation = useUpdateFlashcardCollection(collection.id);
  const archive = async () => {
    try {
      await mutation.mutateAsync({ archived: true });
      toast.success("Coleção arquivada.");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        getFlashcardCollectionErrorMessage(error, "Não foi possível arquivar a coleção."),
      );
    }
  };
  return (
    <ConfirmationDialog
      actionLabel={
        <>
          {mutation.isPending && <Spinner />}
          {mutation.isPending ? "Arquivando..." : "Arquivar coleção"}
        </>
      }
      description={
        <>
          Seus {collection.totalCards}{" "}
          {collection.totalCards === 1 ? "card será preservado" : "cards serão preservados"}. Você
          poderá restaurar a coleção depois.
        </>
      }
      disabled={mutation.isPending}
      media={<ArchiveIcon aria-hidden="true" />}
      onConfirm={archive}
      onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}
      open={open}
      title={`Arquivar “${collection.title}”?`}
    />
  );
};

export const DeleteFlashcardCollectionDialog = ({
  collection,
  onDeleted,
  onOpenChange,
  open,
}: {
  collection: FlashcardCollectionSummary;
  onDeleted: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const mutation = useDeleteFlashcardCollection(collection.id);
  const remove = async () => {
    try {
      await mutation.mutateAsync();
      toast.success("Coleção excluída.");
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      toast.error(getFlashcardCollectionErrorMessage(error, "Não foi possível excluir a coleção."));
    }
  };
  return (
    <ConfirmationDialog
      actionLabel={
        <>
          {mutation.isPending && <Spinner />}
          {mutation.isPending ? "Excluindo..." : "Excluir coleção"}
        </>
      }
      description={
        <>
          {collection.totalCards === 0
            ? "A coleção ainda não possui cards."
            : `${collection.totalCards} ${collection.totalCards === 1 ? "card e seu histórico serão excluídos" : "cards e seus históricos serão excluídos"}.`}{" "}
          Esta ação não pode ser desfeita.
        </>
      }
      destructive
      disabled={mutation.isPending}
      media={<AlertTriangleIcon aria-hidden="true" />}
      mediaClassName="bg-destructive/10 text-destructive"
      onConfirm={remove}
      onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}
      open={open}
      title={`Excluir “${collection.title}”?`}
    />
  );
};
