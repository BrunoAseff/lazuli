import {
  createFlashcardCollectionSchema,
  flashcardCollectionTitleSchema,
  projectIdSchema,
  type FlashcardCollectionSummary,
} from "@lazuli/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangleIcon, ArchiveIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormFieldError } from "@/components/form-field-error.tsx";
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
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import {
  useCreateFlashcardCollection,
  useDeleteFlashcardCollection,
  useUpdateFlashcardCollection,
} from "../api/flashcard-collection-queries.ts";
import { getFlashcardCollectionErrorMessage } from "../flashcard-messages.ts";
import { ProjectFilter } from "./project-filter.tsx";

const collectionFormSchema = z.object({
  title: flashcardCollectionTitleSchema,
  projectId: projectIdSchema.nullable(),
});
type CollectionFormValues = z.input<typeof collectionFormSchema>;

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
  const createId = useRef(crypto.randomUUID());
  const form = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionFormSchema),
    mode: "onChange",
    defaultValues: { title: collection?.title ?? "", projectId: collection?.project?.id ?? null },
  });
  useEffect(() => {
    if (open)
      form.reset({ title: collection?.title ?? "", projectId: collection?.project?.id ?? null });
  }, [collection, form, open]);
  const watchedTitle = form.watch("title");
  const watchedProjectId = form.watch("projectId");
  const parsedTitle = flashcardCollectionTitleSchema.safeParse(watchedTitle);
  const changed = collection
    ? parsedTitle.success &&
      (parsedTitle.data !== collection.title ||
        watchedProjectId !== (collection.project?.id ?? null))
    : true;
  const close = () => {
    onOpenChange(false);
    mutation.reset();
    createId.current = crypto.randomUUID();
  };
  const submit = form.handleSubmit(async (values) => {
    const input = collectionFormSchema.parse(values);
    if (collection && !changed) return;
    try {
      if (collection) {
        await update.mutateAsync(input);
        toast.success("Coleção atualizada.");
      } else {
        await create.mutateAsync(
          createFlashcardCollectionSchema.parse({ ...input, id: createId.current }),
        );
        toast.success("Coleção criada.");
      }
      close();
    } catch (error) {
      toast.error(
        getFlashcardCollectionErrorMessage(
          error,
          collection
            ? "Não foi possível atualizar a coleção."
            : "Não foi possível criar a coleção.",
        ),
      );
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !mutation.isPending && (next ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{collection ? "Renomear e organizar" : "Nova coleção"}</DialogTitle>
          <DialogDescription>
            {collection
              ? "Atualize como esta coleção aparece na sua biblioteca."
              : "Agrupe flashcards relacionados a um mesmo assunto."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="flashcard-collection-title">Título</Label>
            <Input
              {...form.register("title")}
              aria-describedby="flashcard-collection-title-error"
              aria-invalid={Boolean(form.formState.errors.title)}
              autoFocus
              disabled={mutation.isPending}
              id="flashcard-collection-title"
              maxLength={100}
              placeholder="Ex.: Anatomia cardiovascular"
            />
            <FormFieldError
              id="flashcard-collection-title-error"
              message={form.formState.errors.title?.message}
            />
          </div>
          <div className="grid gap-2">
            <Label>Projeto</Label>
            <ProjectFilter
              allowAll={false}
              disabled={mutation.isPending}
              fullWidth
              label="Escolher projeto da coleção"
              onChange={(value) =>
                form.setValue("projectId", value && value !== "none" ? value : null, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              value={watchedProjectId ?? "none"}
            />
            <p className="text-xs text-muted-foreground">
              Opcional. Ajuda a filtrar suas coleções.
            </p>
          </div>
          <DialogFooter>
            <DialogCancelButton disabled={mutation.isPending} onClick={close}>
              Cancelar
            </DialogCancelButton>
            <Button
              disabled={!form.formState.isValid || !changed || mutation.isPending}
              type="submit"
            >
              {mutation.isPending && <Spinner />}
              {mutation.isPending ? "Salvando..." : collection ? "Salvar" : "Criar coleção"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
    <AlertDialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <ArchiveIcon aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>Arquivar “{collection.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Seus {collection.totalCards}{" "}
            {collection.totalCards === 1 ? "card será preservado" : "cards serão preservados"}. Você
            poderá restaurar a coleção depois.
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
    <AlertDialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <AlertTriangleIcon aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>Excluir “{collection.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {collection.totalCards === 0
              ? "A coleção ainda não possui cards."
              : `${collection.totalCards} ${collection.totalCards === 1 ? "card e seu histórico serão excluídos" : "cards e seus históricos serão excluídos"}.`}{" "}
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
