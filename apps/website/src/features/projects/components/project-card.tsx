import type { ProjectSummary } from "@lazuli/shared";
import { FileTextIcon } from "lucide-react";
import { Link } from "react-router";

import { Card } from "@/components/ui/card.tsx";
import { formatProjectDate } from "../format-project-date.ts";
import { HighlightText } from "../highlight-text.tsx";
import { ProjectActionsMenu } from "./project-actions-menu.tsx";
import { ProjectCover } from "./project-cover.tsx";

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
}: ProjectCardProps) => (
  <Card className="group/project-card relative gap-0 rounded-none py-0 transition-shadow hover:shadow-md focus-within:shadow-md">
    <Link
      aria-label={`Abrir projeto ${project.title}`}
      className="block overflow-hidden outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      state={{ projectListLocation: listLocation }}
      to={`/documents/${project.id}`}
    >
      <ProjectCover coverKey={project.coverKey} />
    </Link>
    <div className="grid gap-3 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <Link
          className="min-w-0 flex-1 font-heading text-xl leading-tight font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
          state={{ projectListLocation: listLocation }}
          to={`/documents/${project.id}`}
        >
          <HighlightText query={query} text={project.title} />
        </Link>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <FileTextIcon aria-hidden="true" className="size-3.5" />
          {project.documentCount} {project.documentCount === 1 ? "documento" : "documentos"}
        </span>
        <time dateTime={project.updatedAt}>{formatProjectDate(project.updatedAt)}</time>
      </div>
    </div>
    <ProjectActionsMenu
      className="absolute top-2 right-2 opacity-0 transition-opacity group-hover/project-card:opacity-100 group-focus-within/project-card:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
      onChangeCover={onChangeCover}
      onDelete={onDelete}
      onRename={onRename}
    />
  </Card>
);
