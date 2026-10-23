import { useState } from "react";
import type { ProjectSummary } from "@lazuli/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client.ts";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogCancelButton,
} from "@/components/ui/dialog.tsx";
import { projectKeys, useUpdateProject } from "../api/project-queries.ts";
import {
  initialCoverSelection,
  ProjectCoverEditor,
  uploadProjectCover,
} from "./project-cover-editor.tsx";

export function ChangeProjectCoverDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selection, setSelection] = useState(() => initialCoverSelection(project));
  const [error, setError] = useState("");
  const client = useQueryClient();
  const update = useUpdateProject(project.id);
  const upload = useMutation({
    mutationFn: () => uploadProjectCover(project, selection),
    onSuccess: async (value) => {
      client.setQueryData(projectKeys.detail(project.id), value);
      await Promise.all([
        client.invalidateQueries({ queryKey: projectKeys.lists() }),
        client.invalidateQueries({ queryKey: ["account-settings", "usage"] }),
        client.invalidateQueries({ queryKey: ["billing"] }),
      ]);
    },
  });
  const busy = update.isPending || upload.isPending;
  const save = async () => {
    setError("");
    try {
      if (selection.mode === "upload") await upload.mutateAsync();
      else
        await update.mutateAsync({
          coverKey: selection.preset,
          expectedCover: { assetId: project.coverAssetId ?? null, key: project.coverKey },
        });
      toast.success(
        selection.mode === "gallery" && !selection.preset ? "Capa removida." : "Capa atualizada.",
      );
      onOpenChange(false);
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.code === "COVER_CHANGED"
          ? "A capa mudou em outra aba. Feche e abra novamente para continuar."
          : cause instanceof ApiError && cause.code === "PLAN_STORAGE_LIMIT_REACHED"
            ? "Não há espaço suficiente no seu plano para esta imagem."
            : "Não foi possível salvar a capa. Tente novamente.",
      );
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Alterar capa</DialogTitle>
          <DialogDescription>Escolha a capa de {project.title}.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto -mx-1 px-1">
          <ProjectCoverEditor
            project={project}
            value={selection}
            onChange={setSelection}
            disabled={busy}
          />
          {error && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogCancelButton disabled={busy} onClick={() => onOpenChange(false)}>
            Cancelar
          </DialogCancelButton>
          <Button
            disabled={
              busy ||
              (selection.mode === "upload"
                ? !selection.file
                : !selection.presetChanged ||
                  (selection.preset === project.coverKey && !project.coverAssetId))
            }
            onClick={() => void save()}
          >
            {busy && <Spinner />}
            {busy ? "Salvando…" : "Salvar capa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
