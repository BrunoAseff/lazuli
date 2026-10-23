import type { ProjectSummary } from "@lazuli/shared";
import { Link } from "react-router";

import { HighlightText } from "@/components/highlight-text.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { formatProjectDate } from "../format-project-date.ts";
import { ProjectActionsMenu } from "./project-actions-menu.tsx";
import { ProjectCover } from "./project-cover.tsx";
import type { ProjectAction } from "../project-types.ts";
import { FavoriteButton } from "@/features/favorites/favorite-button.tsx";

type ProjectTableProps = {
  listLocation: string;
  onAction: (action: ProjectAction, project: ProjectSummary) => void;
  projects: ProjectSummary[];
  query: string;
};

const ProjectTitleLink = ({
  listLocation,
  project,
  query,
}: {
  listLocation: string;
  project: ProjectSummary;
  query: string;
}) => {
  return (
    <OverflowTooltip text={project.title}>
      {(ref) => (
        <Link
          className="block truncate font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
          ref={ref as React.RefObject<HTMLAnchorElement>}
          state={{ projectListLocation: listLocation }}
          to={`/documents/${project.id}`}
        >
          <HighlightText query={query} text={project.title} />
        </Link>
      )}
    </OverflowTooltip>
  );
};

export const ProjectTable = ({ listLocation, onAction, projects, query }: ProjectTableProps) => (
  <div className="overflow-hidden rounded-xl border bg-card">
    <table className="w-full table-fixed text-left text-sm">
      <thead className="border-b bg-muted/55 text-xs text-muted-foreground">
        <tr>
          <th className="w-auto px-4 py-3 font-medium" scope="col">
            Projeto
          </th>
          <th className="hidden w-32 px-4 py-3 font-medium sm:table-cell" scope="col">
            Documentos
          </th>
          <th className="hidden w-44 px-4 py-3 font-medium md:table-cell" scope="col">
            Atualizado em
          </th>
          <th className="w-24 px-2 py-3" scope="col">
            <span className="sr-only">Ações</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {projects.map((project) => (
          <tr className="group transition-colors hover:bg-muted/25" key={project.id}>
            <td className="px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <ProjectCover
                  className="hidden h-10 w-[4.5rem] shrink-0 rounded-[var(--radius)] sm:grid"
                  compact
                  coverKey={project.coverKey}
                  assetId={project.coverThumbnailAssetId ?? project.coverAssetId}
                />
                <div className="min-w-0">
                  <ProjectTitleLink listLocation={listLocation} project={project} query={query} />
                  <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                    {project.documentCount}{" "}
                    {project.documentCount === 1 ? "documento" : "documentos"}
                  </span>
                </div>
              </div>
            </td>
            <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
              {project.documentCount}
            </td>
            <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
              <time dateTime={project.updatedAt}>{formatProjectDate(project.updatedAt)}</time>
            </td>
            <td className="px-3 py-3 text-right">
              <div className="flex items-center justify-end gap-1">
                <FavoriteButton kind="project" id={project.id} title={project.title} />
                <ProjectActionsMenu
                  favorite={{ kind: "project", id: project.id }}
                  className="shadow-none"
                  onChangeCover={() => onAction("cover", project)}
                  onDelete={() => onAction("delete", project)}
                  onRename={() => onAction("rename", project)}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
