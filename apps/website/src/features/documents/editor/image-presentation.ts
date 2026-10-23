export type ImageResolution =
  | { loadingState: "error" }
  | { loadingState: "loading" }
  | { downloadUrl: string; loadingState: "loaded" };

export type ImagePresentation =
  | { kind: "error" }
  | { kind: "loading" }
  | { kind: "ready"; source: string }
  | { kind: "uploading" };

export const getImagePresentation = (
  pendingUpload: boolean,
  resolved: ImageResolution,
  failedSource?: string,
): ImagePresentation => {
  if (pendingUpload) return { kind: "uploading" };
  if (resolved.loadingState === "loading") return { kind: "loading" };
  if (resolved.loadingState === "error") return { kind: "error" };
  if (failedSource === resolved.downloadUrl) return { kind: "error" };
  return { kind: "ready", source: resolved.downloadUrl };
};
