import type { ProjectCoverKey } from "@lazuli/shared";
import { cn } from "@/lib/utils.ts";
import { getProjectCover } from "../project-covers.ts";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api-client.ts";

/** Small deterministic hash so each project keeps the same facet arrangement across sessions. */
const seedOf = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++)
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
};

const FACET = "m0-7 7 7-7 7-7-7Z";

/**
 * A project without an image still has a cover: a lattice of the lapis facets from the brand mark,
 * with a few stones set in ink. Arrangement comes from the project id, never from content.
 */
export const MineralCover = ({ seed, className }: { seed: string; className?: string }) => {
  let state = seedOf(seed) || 1;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const columns = 13;
  const rows = 8;
  const cells: { x: number; y: number; tone: "line" | "stone" | "deep" }[] = [];
  // Sparse field: most positions stay empty so the facets read as a few set stones, not a pattern.
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const roll = next();
      if (roll < 0.62) continue;
      cells.push({
        x: column * 16 + (row % 2 ? 8 : 0),
        y: row * 14 + 2,
        tone: roll > 0.975 ? "deep" : roll > 0.9 ? "stone" : "line",
      });
    }
  const angle = Math.round(next() * 40 - 20);
  return (
    <svg
      aria-hidden="true"
      className={cn("mineral-cover block aspect-video size-full", className)}
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 192 108"
    >
      <defs>
        <linearGradient
          id={`mineral-${seed}`}
          gradientTransform={`rotate(${angle} .5 .5)`}
          x1="0"
          x2="1"
          y1="0"
          y2="1"
        >
          <stop className="mineral-cover-light" offset="0" />
          <stop className="mineral-cover-dark" offset="1" />
        </linearGradient>
      </defs>
      <rect fill={`url(#mineral-${seed})`} height="108" width="192" />
      {cells.map(({ x, y, tone }, index) => (
        <path className="mineral-facet" d={`M${x} ${y}${FACET}`} data-tone={tone} key={index} />
      ))}
    </svg>
  );
};

export const ProjectCover = ({
  coverKey,
  assetId,
  className,
  picker = false,
  seed,
}: {
  coverKey: ProjectCoverKey | null;
  assetId?: string | null;
  className?: string;
  compact?: boolean;
  picker?: boolean;
  /** Project id: identifies the generated mineral cover when there is no image. */
  seed?: string;
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

  if (!cover) return <MineralCover className={className} seed={seed ?? "lazuli"} />;

  return (
    <img
      alt={picker ? cover.description : ""}
      className={cn("aspect-video size-full object-cover", className)}
      loading="lazy"
      src={cover.src}
    />
  );
};
