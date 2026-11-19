import { useEffect, useRef, useState } from "react";
import type { ProjectCoverKey, ProjectSummary } from "@lazuli/shared";
import { projectSummarySchema } from "@lazuli/shared";
import { API_URL, apiRequest } from "@/lib/api-client.ts";
import { AutoHeight } from "@/components/auto-height.tsx";
import { FileDropzone } from "@/components/file-dropzone.tsx";
import { ReplaceIcon } from "@/components/icons.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { CoverPicker } from "./cover-picker.tsx";
import { ProjectCover } from "./project-cover.tsx";

export type CoverSelection = {
  mode: string;
  preset: ProjectCoverKey | null;
  presetChanged: boolean;
  file?: File;
  /** The file is the stored original of the current cover: saving it only reframes. */
  fromSource?: boolean;
  crop: { x: number; y: number; zoom: number };
  uploadId: string;
};
type CoverProject = Pick<
  ProjectSummary,
  "coverAssetId" | "coverKey" | "coverCropX" | "coverCropY" | "coverCropZoom"
>;
const savedCrop = (project?: CoverProject) => ({
  x: project?.coverCropX ?? 50,
  y: project?.coverCropY ?? 50,
  zoom: project?.coverCropZoom ?? 1,
});
export const initialCoverSelection = (project?: CoverProject): CoverSelection => ({
  mode: project?.coverAssetId ? "upload" : "gallery",
  preset: project ? project.coverKey : "library",
  presetChanged: false,
  crop: savedCrop(project),
  uploadId: crypto.randomUUID(),
});

/** Whether saving would change anything in the upload tab. */
export const coverUploadChanged = (selection: CoverSelection, project?: CoverProject) => {
  if (!selection.file) return false;
  if (!selection.fromSource) return true;
  const saved = savedCrop(project);
  return (
    selection.crop.x !== saved.x ||
    selection.crop.y !== saved.y ||
    selection.crop.zoom !== saved.zoom
  );
};

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
  const picker = useRef<HTMLInputElement>(null);
  const latest = useRef(value);
  latest.current = value;
  const change = useRef(onChange);
  change.current = onChange;
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
  // An uploaded cover can be reframed: its stored original is loaded as the image being edited.
  const sourceId = project?.coverSourceAssetId;
  useEffect(() => {
    if (!sourceId) return;
    const controller = new AbortController();
    void fetch(`${API_URL}/api/assets/${encodeURIComponent(sourceId)}/content`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const blob = await response.blob();
        if (controller.signal.aborted || latest.current.file) return;
        change.current({
          ...latest.current,
          file: new File([blob], "capa-original.webp", { type: blob.type || "image/webp" }),
          fromSource: true,
        });
      })
      .catch(() => {
        /* Without the original the current cover stays, and a new image can still be chosen. */
      });
    return () => controller.abort();
  }, [sourceId]);
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
          ...latest.current,
          file,
          fromSource: false,
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
        <TabsList variant="line" className="mb-3 shrink-0">
          <TabsTrigger value="gallery" disabled={disabled}>
            Galeria
          </TabsTrigger>
          <TabsTrigger value="upload" disabled={disabled}>
            Enviar imagem
          </TabsTrigger>
        </TabsList>
        <AutoHeight>
          <TabsContent value="gallery" className="p-1">
            <CoverPicker
              disabled={disabled}
              value={
                value.presetChanged
                  ? value.preset
                  : project?.coverAssetId
                    ? undefined
                    : value.preset
              }
              onChange={(preset) => onChange({ ...value, preset, presetChanged: true })}
            />
          </TabsContent>
          <TabsContent value="upload" className="p-1">
            <input
              ref={picker}
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={disabled}
              onChange={(event) => {
                void choose(event.target.files?.[0]);
                event.target.value = "";
              }}
              tabIndex={-1}
              type="file"
            />
            {preview || project?.coverAssetId ? (
              // The image and its framing side by side: everything fits without scrolling.
              <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_13rem]">
                <div className="aspect-video overflow-hidden rounded-lg bg-muted">
                  {preview ? (
                    <img
                      alt="Prévia da capa"
                      src={preview}
                      className="size-full object-cover transition-[object-position,transform] duration-200 ease-out motion-reduce:transition-none"
                      style={{
                        objectPosition: `${value.crop.x}% ${value.crop.y}%`,
                        transform: `scale(${value.crop.zoom})`,
                        transformOrigin: `${value.crop.x}% ${value.crop.y}%`,
                      }}
                    />
                  ) : (
                    <ProjectCover
                      coverKey={null}
                      assetId={project?.coverAssetId ?? undefined}
                      className="h-auto"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-4">
                  <fieldset disabled={disabled || !value.file} className="grid gap-1">
                    <legend className="mb-1 text-sm font-medium">Enquadramento</legend>
                    {(
                      [
                        { key: "zoom", label: "Zoom", min: 1, max: 3, step: 0.05 },
                        { key: "x", label: "Horizontal", min: 0, max: 100, step: 1 },
                        { key: "y", label: "Vertical", min: 0, max: 100, step: 1 },
                      ] as const
                    ).map(({ key, label, ...range }) => (
                      <div key={key} className="grid text-sm text-muted-foreground">
                        <span>{label}</span>
                        <Slider
                          aria-label={label}
                          className="min-h-8"
                          {...range}
                          disabled={disabled || !value.file}
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
                  {!value.file && !sourceId && (
                    <p className="text-xs text-muted-foreground">
                      Esta capa foi enviada antes do ajuste de enquadramento. Envie a imagem de novo
                      para ajustá-la.
                    </p>
                  )}
                  <div className="mt-auto grid gap-1.5">
                    <Button
                      className="w-fit"
                      disabled={disabled}
                      onClick={() => picker.current?.click()}
                      type="button"
                      variant="outline"
                    >
                      <ReplaceIcon aria-hidden="true" /> Trocar imagem
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      JPEG, PNG ou WebP · até 10 MB e 25 MP
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <FileDropzone
                accept="image/jpeg,image/png,image/webp"
                disabled={disabled}
                buttonLabel="Escolher imagem"
                description="Uma imagem para reconhecer este projeto na sua biblioteca."
                hint="JPEG, PNG ou WebP · até 10 MB e 25 MP"
                onFiles={(files) => void choose(files[0])}
              />
            )}
          </TabsContent>
        </AutoHeight>
      </Tabs>
      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
