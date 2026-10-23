import { useEffect, useRef, useState } from "react";
import type { ProjectCoverKey, ProjectSummary } from "@lazuli/shared";
import { projectSummarySchema } from "@lazuli/shared";
import { apiRequest } from "@/lib/api-client.ts";
import { FileDropzone } from "@/components/file-dropzone.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { CoverPicker } from "./cover-picker.tsx";
import { ProjectCover } from "./project-cover.tsx";

export type CoverSelection = {
  mode: string;
  preset: ProjectCoverKey | null;
  presetChanged: boolean;
  file?: File;
  crop: { x: number; y: number; zoom: number };
  uploadId: string;
};
export const initialCoverSelection = (
  project?: Pick<ProjectSummary, "coverAssetId" | "coverKey">,
): CoverSelection => ({
  mode: project?.coverAssetId ? "upload" : "gallery",
  preset: project ? project.coverKey : "library",
  presetChanged: false,
  crop: { x: 50, y: 50, zoom: 1 },
  uploadId: crypto.randomUUID(),
});

export const uploadProjectCover = (project: ProjectSummary, selection: CoverSelection) => {
  if (!selection.file) throw new Error("Selecione uma imagem.");
  const body = new FormData();
  body.set("uploadId", selection.uploadId);
  body.set("expectedAssetId", project.coverAssetId ?? "");
  body.set("expectedCoverKey", project.coverKey ?? "");
  for (const [key, value] of Object.entries(selection.crop)) body.set(key, String(value));
  body.set("file", selection.file);
  return apiRequest(`/api/projects/${project.id}/cover`, projectSummarySchema, {
    method: "POST",
    body,
  });
};

export function ProjectCoverEditor({
  value,
  onChange,
  disabled = false,
  project,
}: {
  value: CoverSelection;
  onChange: (value: CoverSelection) => void;
  disabled?: boolean;
  project?: ProjectSummary;
}) {
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState("");
  const sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current += 1;
    },
    [],
  );
  useEffect(() => {
    if (!value.file) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(value.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value.file]);
  const choose = async (file?: File) => {
    const current = ++sequence.current;
    setError("");
    if (!file) return;
    if (
      file.size > 10 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("Escolha uma imagem JPEG, PNG ou WebP de até 10 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth * image.naturalHeight > 25_000_000)
        throw new Error("A imagem deve ter no máximo 25 megapixels.");
      if (current === sequence.current)
        onChange({
          ...value,
          file,
          crop: { x: 50, y: 50, zoom: 1 },
          uploadId: crypto.randomUUID(),
        });
    } catch {
      if (current === sequence.current)
        setError("Não foi possível abrir a imagem. Use uma imagem estática de até 25 megapixels.");
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  return (
    <div className="py-1">
      <Tabs value={value.mode} onValueChange={(mode) => onChange({ ...value, mode })}>
        <TabsList variant="line" className="mb-3">
          <TabsTrigger value="gallery" disabled={disabled}>
            Galeria
          </TabsTrigger>
          <TabsTrigger value="upload" disabled={disabled}>
            Enviar imagem
          </TabsTrigger>
        </TabsList>
        <TabsContent value="gallery" className="p-1">
          <CoverPicker
            disabled={disabled}
            value={value.presetChanged ? value.preset : project?.coverAssetId ? null : value.preset}
            onChange={(preset) => onChange({ ...value, preset, presetChanged: true })}
          />
        </TabsContent>
        <TabsContent value="upload" className="space-y-3 p-1">
          <FileDropzone
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled}
            buttonLabel={value.file || project?.coverAssetId ? "Trocar imagem" : "Escolher imagem"}
            replacing={Boolean(value.file || project?.coverAssetId)}
            onFiles={(files) => void choose(files[0])}
          >
            {preview ? (
              <div className="aspect-video overflow-hidden rounded-lg">
                <img
                  alt="Prévia da nova capa"
                  src={preview}
                  className="size-full object-cover"
                  style={{
                    objectPosition: `${value.crop.x}% ${value.crop.y}%`,
                    transform: `scale(${value.crop.zoom})`,
                    transformOrigin: `${value.crop.x}% ${value.crop.y}%`,
                  }}
                />
              </div>
            ) : project?.coverAssetId ? (
              <ProjectCover
                coverKey={null}
                assetId={project.coverAssetId}
                className="h-auto rounded-lg"
              />
            ) : undefined}
          </FileDropzone>
          <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP · até 10 MB e 25 MP</p>
          {value.file && (
            <fieldset disabled={disabled} className="space-y-1">
              <legend className="mb-1 text-sm font-medium">Enquadramento</legend>
              {(
                [
                  { key: "zoom", label: "Zoom", min: 1, max: 3, step: 0.05 },
                  { key: "x", label: "Horizontal", min: 0, max: 100, step: 1 },
                  { key: "y", label: "Vertical", min: 0, max: 100, step: 1 },
                ] as const
              ).map(({ key, label, ...range }) => (
                <div
                  key={key}
                  className="grid min-h-11 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 text-sm text-muted-foreground"
                >
                  <span>{label}</span>
                  <Slider
                    aria-label={label}
                    {...range}
                    disabled={disabled}
                    value={[value.crop[key]]}
                    onValueChange={([next]) => {
                      if (next !== undefined)
                        onChange({
                          ...value,
                          crop: { ...value.crop, [key]: next },
                          uploadId: crypto.randomUUID(),
                        });
                    }}
                  />
                </div>
              ))}
            </fieldset>
          )}
        </TabsContent>
      </Tabs>
      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
