import type {
  CreateFlashcardCollectionInput,
  FlashcardCollectionSummary,
  UpdateFlashcardCollectionInput,
} from "@lazuli/shared";
import { toast } from "sonner";

import { StudyCollectionConfirmationDialog } from "@/components/study-collection-confirmation-dialog.tsx";
import { StudyCollectionDialog } from "@/components/study-collection-dialog.tsx";
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
    <StudyCollectionConfirmationDialog
      description={
        <>
          Seus {collection.totalCards}{" "}
          {collection.totalCards === 1 ? "card será preservado" : "cards serão preservados"}. Você
          poderá restaurar a coleção depois.
        </>
      }
      mode="archive"
      onConfirm={archive}
      onOpenChange={onOpenChange}
      open={open}
      pending={mutation.isPending}
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
    <StudyCollectionConfirmationDialog
      description={
        <>
          {collection.totalCards === 0
            ? "A coleção ainda não possui cards."
            : `${collection.totalCards} ${collection.totalCards === 1 ? "card e seu histórico serão excluídos" : "cards e seus históricos serão excluídos"}.`}{" "}
          Esta ação não pode ser desfeita.
        </>
      }
      mode="delete"
      onConfirm={remove}
      onOpenChange={onOpenChange}
      open={open}
      pending={mutation.isPending}
      title={`Excluir “${collection.title}”?`}
    />
  );
};
