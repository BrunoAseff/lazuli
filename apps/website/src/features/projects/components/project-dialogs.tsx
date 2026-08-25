import {
  createProjectSchema,
  type ProjectCoverKey,
  type ProjectSummary,
  projectTitleSchema,
} from "@lazuli/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { FormFieldError } from "@/components/form-field-error.tsx";
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
import { useCreateProject, useDeleteProject, useUpdateProject } from "../api/project-queries.ts";
import { ProjectApiError } from "../api/project-api.ts";
import { getProjectErrorMessage } from "../project-messages.ts";
import { CoverPicker } from "./cover-picker.tsx";

const renameProjectSchema = z.object({ title: projectTitleSchema });
type RenameProjectValues = z.input<typeof renameProjectSchema>;
type CreateProjectValues = z.input<typeof createProjectSchema>;

export const CreateProjectDialog = ({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const mutation = useCreateProject();
  const form = useForm<CreateProjectValues>({
    resolver: zodResolver(createProjectSchema),
    mode: "onChange",
    defaultValues: {
      id: crypto.randomUUID(),
      title: "",
      coverKey: "library",
    },
  });

  const close = () => {
    onOpenChange(false);
    form.reset({ id: crypto.randomUUID(), title: "", coverKey: "library" });
    mutation.reset();
  };

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(createProjectSchema.parse(values));
      toast.success("Projeto criado.");
      close();
    } catch (error) {
      toast.error(
        getProjectErrorMessage(
          error instanceof ProjectApiError ? error : null,
          "Não foi possível criar o projeto.",
        ),
      );
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !mutation.isPending && (nextOpen ? onOpenChange(true) : close())}
    >
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Novo projeto</DialogTitle>
          <DialogDescription>
            Organize documentos relacionados em um único espaço.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="new-project-title">Título</Label>
            <Input
              {...form.register("title")}
              aria-describedby="new-project-title-error"
              aria-invalid={Boolean(form.formState.errors.title)}
              autoFocus
              disabled={mutation.isPending}
              id="new-project-title"
              maxLength={100}
              placeholder="Ex.: Física moderna"
            />
            <FormFieldError
              id="new-project-title-error"
              message={form.formState.errors.title?.message}
            />
          </div>
          <CoverPicker
            disabled={mutation.isPending}
            onChange={(coverKey) => form.setValue("coverKey", coverKey, { shouldValidate: true })}
            value={form.watch("coverKey") ?? null}
          />
          <DialogFooter>
            <DialogCancelButton disabled={mutation.isPending} onClick={close}>
              Cancelar
            </DialogCancelButton>
            <Button disabled={!form.formState.isValid || mutation.isPending} type="submit">
              {mutation.isPending && <Spinner />}
              {mutation.isPending ? "Criando..." : "Criar projeto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const RenameProjectDialog = ({
  onOpenChange,
  open,
  project,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  project: ProjectSummary;
}) => {
  const mutation = useUpdateProject(project.id);
  const form = useForm<RenameProjectValues>({
    resolver: zodResolver(renameProjectSchema),
    mode: "onChange",
    defaultValues: { title: project.title },
  });

  useEffect(() => {
    if (open) form.reset({ title: project.title });
  }, [form, open, project.title]);

  const parsedTitle = projectTitleSchema.safeParse(form.watch("title"));
  const hasChanges = parsedTitle.success && parsedTitle.data !== project.title;

  const close = () => {
    onOpenChange(false);
    mutation.reset();
  };

  const submit = form.handleSubmit(async (values) => {
    const input = renameProjectSchema.parse(values);
    if (input.title === project.title) return;

    try {
      await mutation.mutateAsync(input);
      toast.success("Projeto renomeado.");
      close();
    } catch (error) {
      toast.error(
        getProjectErrorMessage(
          error instanceof ProjectApiError ? error : null,
          "Não foi possível renomear o projeto.",
        ),
      );
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !mutation.isPending && (nextOpen ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renomear projeto</DialogTitle>
          <DialogDescription>O novo título aparecerá em toda a sua biblioteca.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor={`rename-project-${project.id}`}>Título</Label>
            <Input
              {...form.register("title")}
              aria-describedby={`rename-project-${project.id}-error`}
              aria-invalid={Boolean(form.formState.errors.title)}
              autoFocus
              disabled={mutation.isPending}
              id={`rename-project-${project.id}`}
              maxLength={100}
            />
            <FormFieldError
              id={`rename-project-${project.id}-error`}
              message={form.formState.errors.title?.message}
            />
          </div>
          <DialogFooter>
            <DialogCancelButton disabled={mutation.isPending} onClick={close}>
              Cancelar
            </DialogCancelButton>
            <Button
              disabled={!form.formState.isValid || !hasChanges || mutation.isPending}
              type="submit"
            >
              {mutation.isPending && <Spinner />}
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const ChangeProjectCoverDialog = ({
  onOpenChange,
  open,
  project,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  project: ProjectSummary;
}) => {
  const [coverKey, setCoverKey] = useState<ProjectCoverKey | null>(project.coverKey);
  const mutation = useUpdateProject(project.id);

  useEffect(() => {
    if (open) setCoverKey(project.coverKey);
  }, [open, project.coverKey]);

  const close = () => {
    onOpenChange(false);
    mutation.reset();
  };

  const save = async () => {
    if (coverKey === project.coverKey) return;

    try {
      await mutation.mutateAsync({ coverKey });
      toast.success(coverKey ? "Capa atualizada." : "Capa removida.");
      close();
    } catch (error) {
      toast.error(
        getProjectErrorMessage(
          error instanceof ProjectApiError ? error : null,
          "Não foi possível alterar a capa.",
        ),
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !mutation.isPending && (nextOpen ? onOpenChange(true) : close())}
    >
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Alterar capa</DialogTitle>
          <DialogDescription>
            Escolha uma imagem para identificar {project.title}.
          </DialogDescription>
        </DialogHeader>
        <CoverPicker disabled={mutation.isPending} onChange={setCoverKey} value={coverKey} />
        <DialogFooter>
          <DialogCancelButton disabled={mutation.isPending} onClick={close}>
            Cancelar
          </DialogCancelButton>
          <Button
            disabled={mutation.isPending || coverKey === project.coverKey}
            onClick={save}
            type="button"
          >
            {mutation.isPending && <Spinner />}
            {mutation.isPending ? "Salvando..." : "Salvar capa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const DeleteProjectDialog = ({
  onDeleted,
  onOpenChange,
  open,
  project,
}: {
  onDeleted?: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  project: ProjectSummary;
}) => {
  const mutation = useDeleteProject(project.id);
  const deleteProject = async () => {
    try {
      await mutation.mutateAsync();
      toast.success("Projeto excluído.");
      onOpenChange(false);
      onDeleted?.();
    } catch (error) {
      toast.error(
        getProjectErrorMessage(
          error instanceof ProjectApiError ? error : null,
          "Não foi possível excluir o projeto.",
        ),
      );
    }
  };

  const documentMessage =
    project.documentCount === 0
      ? "Ele ainda não possui documentos."
      : `${project.documentCount} ${project.documentCount === 1 ? "documento será excluído" : "documentos serão excluídos"} junto com ele.`;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => !mutation.isPending && onOpenChange(nextOpen)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <AlertTriangleIcon aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>Excluir “{project.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {documentMessage} Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              void deleteProject();
            }}
            variant="destructive"
          >
            {mutation.isPending && <Spinner />}
            {mutation.isPending ? "Excluindo..." : "Excluir projeto"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
