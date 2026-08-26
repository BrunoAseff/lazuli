import {
  projectIdSchema,
  studyCollectionTitleSchema,
  type CreateStudyCollectionInput,
  type UpdateStudyCollectionInput,
} from "@lazuli/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormFieldError } from "@/components/form-field-error.tsx";
import { ProjectFilter } from "@/components/project-filter.tsx";
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

const formSchema = z.object({
  title: studyCollectionTitleSchema,
  projectId: projectIdSchema.nullable(),
});
type FormValues = z.input<typeof formSchema>;
type Collection = { title: string; project: { id: string } | null };
type SubmitInput = CreateStudyCollectionInput | UpdateStudyCollectionInput;

export const StudyCollectionDialog = ({
  collection,
  createDescription,
  onOpenChange,
  onReset,
  onSubmit,
  open,
  pending,
  placeholder,
}: {
  collection?: Collection;
  createDescription: string;
  onOpenChange: (open: boolean) => void;
  onReset: () => void;
  onSubmit: (input: SubmitInput) => Promise<void>;
  open: boolean;
  pending: boolean;
  placeholder: string;
}) => {
  const createId = useRef(crypto.randomUUID());
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: { title: collection?.title ?? "", projectId: collection?.project?.id ?? null },
  });
  useEffect(() => {
    if (open)
      form.reset({ title: collection?.title ?? "", projectId: collection?.project?.id ?? null });
  }, [collection, form, open]);
  const watchedTitle = form.watch("title");
  const watchedProjectId = form.watch("projectId");
  const parsedTitle = studyCollectionTitleSchema.safeParse(watchedTitle);
  const changed = collection
    ? parsedTitle.success &&
      (parsedTitle.data !== collection.title ||
        watchedProjectId !== (collection.project?.id ?? null))
    : true;
  const close = () => {
    onOpenChange(false);
    onReset();
    createId.current = crypto.randomUUID();
  };
  const submit = form.handleSubmit(async (values) => {
    const input = formSchema.parse(values);
    if (collection && !changed) return;
    await onSubmit(collection ? input : { ...input, id: createId.current });
    close();
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && (next ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{collection ? "Renomear e organizar" : "Nova coleção"}</DialogTitle>
          <DialogDescription>
            {collection
              ? "Atualize como esta coleção aparece na sua biblioteca."
              : createDescription}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="study-collection-title">Título</Label>
            <Input
              {...form.register("title")}
              aria-describedby="study-collection-title-error"
              aria-invalid={Boolean(form.formState.errors.title)}
              autoFocus
              disabled={pending}
              id="study-collection-title"
              maxLength={100}
              placeholder={placeholder}
            />
            <FormFieldError
              id="study-collection-title-error"
              message={form.formState.errors.title?.message}
            />
          </div>
          <div className="grid gap-2">
            <Label>Projeto</Label>
            <ProjectFilter
              allowAll={false}
              disabled={pending}
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
            <DialogCancelButton disabled={pending} onClick={close}>
              Cancelar
            </DialogCancelButton>
            <Button disabled={!form.formState.isValid || !changed || pending} type="submit">
              {pending && <Spinner />}
              {pending ? "Salvando..." : collection ? "Salvar" : "Criar coleção"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
