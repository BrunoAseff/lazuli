import type { ProjectCoverKey } from "@lazuli/shared";
import { FolderIcon, FolderOpenIcon } from "lucide-react";

import { cn } from "@/lib/utils.ts";
import { getProjectCover } from "../project-covers.ts";

export const ProjectCover = ({
  coverKey,
  className,
  compact = false,
  picker = false,
}: {
  coverKey: ProjectCoverKey | null;
  className?: string;
  compact?: boolean;
  picker?: boolean;
}) => {
  const cover = getProjectCover(coverKey);

  if (!cover) {
    return (
      <div
        className={cn(
          "grid aspect-video w-full place-items-center bg-[radial-gradient(circle_at_20%_20%,color-mix(in_oklch,var(--primary),transparent_72%),transparent_38%),linear-gradient(145deg,var(--muted),var(--card))] text-primary",
          className,
        )}
      >
        {compact ? (
          <FolderIcon aria-hidden="true" className="size-[1.125rem]" />
        ) : (
          <FolderOpenIcon aria-hidden="true" className={picker ? "size-5" : "size-8"} />
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
