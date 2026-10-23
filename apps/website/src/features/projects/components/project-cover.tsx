import type { ProjectCoverKey } from "@lazuli/shared";
import { ProjectClosedIcon, ProjectOpenIcon } from "@/components/domain-icons.ts";
import { cn } from "@/lib/utils.ts";
import { getProjectCover } from "../project-covers.ts";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api-client.ts";

export const ProjectCover = ({
  coverKey,
  assetId,
  className,
  compact = false,
  picker = false,
}: {
  coverKey: ProjectCoverKey | null;
  assetId?: string | null;
  className?: string;
  compact?: boolean;
  picker?: boolean;
}) => {
  const cover = getProjectCover(coverKey);
  const [uploaded, setUploaded] = useState<{ id: string; url: string }>();
  useEffect(() => {
    if (!assetId) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void fetch(`${API_URL}/api/assets/${encodeURIComponent(assetId)}/content`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Cover unavailable");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUploaded({ id: assetId, url: objectUrl });
      })
      .catch(() => {
        /* Keep the project's existing visual fallback. */
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);
  const uploadedUrl = uploaded && uploaded.id === assetId ? uploaded.url : undefined;

  if (uploadedUrl)
    return (
      <img
        alt=""
        className={cn("aspect-video size-full object-cover", className)}
        src={uploadedUrl}
        loading="lazy"
        width={1600}
        height={900}
      />
    );

  if (!cover) {
    return (
      <div
        className={cn(
          "grid aspect-video w-full place-items-center bg-[radial-gradient(circle_at_20%_20%,color-mix(in_oklch,var(--primary),transparent_72%),transparent_38%),linear-gradient(145deg,var(--muted),var(--card))] text-primary",
          className,
        )}
      >
        {compact ? (
          <ProjectClosedIcon aria-hidden="true" className="size-[1.125rem]" weight="duotone" />
        ) : (
          <ProjectOpenIcon
            aria-hidden="true"
            className={picker ? "size-5" : "size-8"}
            weight="duotone"
          />
        )}
      </div>
    );
  }

  return (
    <img
      alt={picker ? cover.description : ""}
      className={cn("aspect-video size-full object-cover", className)}
      loading="lazy"
      src={cover.src}
    />
  );
};
