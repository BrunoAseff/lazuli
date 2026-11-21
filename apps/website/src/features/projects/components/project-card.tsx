import type { ProjectSummary } from "@lazuli/shared";
import { Link } from "react-router";

import { DocumentDomainIcon } from "@/components/domain-icons.ts";
import { Card } from "@/components/ui/card.tsx";
import { formatProjectDate } from "../format-project-date.ts";
import { HighlightText } from "@/components/highlight-text.tsx";
import { ProjectActionsMenu } from "./project-actions-menu.tsx";
import { ProjectCover } from "./project-cover.tsx";
import { FavoriteButton } from "@/features/favorites/favorite-button.tsx";

type ProjectCardProps = {
  listLocation: string;
  onChangeCover: () => void;
  onDelete: () => void;
  onRename: () => void;
  project: ProjectSummary;
  query: string;
};

export const ProjectCard = ({
  listLocation,
  onChangeCover,
  onDelete,
  onRename,
  project,
  query,
}: ProjectCardProps) => {
  return (
    <Card className="group/project-card relative gap-0 overflow-hidden py-0 ring-border/50">
      <Link
        aria-label={`Abrir projeto ${project.title}`}
        className="block overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        state={{ projectListLocation: listLocation }}
        to={`/documents/${project.id}`}
      >
        <ProjectCover
          className="transition-transform duration-200 ease-out group-hover/project-card:scale-[1.025] motion-reduce:transition-none motion-reduce:transform-none"
          coverKey={project.coverKey}
          assetId={project.coverThumbnailAssetId ?? project.coverAssetId}
          seed={project.id}
        />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <Link
            className="min-w-0 flex-1 font-heading text-base leading-snug font-medium [overflow-wrap:anywhere] underline-offset-4 outline-none hover:underline focus-visible:underline"
            state={{ projectListLocation: listLocation }}
            to={`/documents/${project.id}`}
          >
            <HighlightText query={query} text={project.title} />
          </Link>
          <FavoriteButton
            kind="project"
            id={project.id}
            title={project.title}
            className="-mt-2 -mr-2"
          />
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <DocumentDomainIcon aria-hidden="true" className="size-4" />
            {project.documentCount} {project.documentCount === 1 ? "documento" : "documentos"}
          </span>
          <div className="flex items-center gap-2">
            <time dateTime={project.updatedAt}>{formatProjectDate(project.updatedAt)}</time>
            {/* Same optical inset as the favorite above, so both icons share one column. */}
            <ProjectActionsMenu
              className="-mr-2"
              favorite={{ kind: "project", id: project.id }}
              onChangeCover={onChangeCover}
              onDelete={onDelete}
              onRename={onRename}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};
