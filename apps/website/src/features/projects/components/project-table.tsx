import type { ProjectSummary } from "@lazuli/shared";
import { Link } from "react-router";

import { formatProjectDate } from "../format-project-date.ts";
import { HighlightText } from "../highlight-text.tsx";
import { ProjectActionsMenu } from "./project-actions-menu.tsx";
import { ProjectCover } from "./project-cover.tsx";

type ProjectTableProps = {
  listLocation: string;
  onAction: (action: "cover" | "delete" | "rename", project: ProjectSummary) => void;
  projects: ProjectSummary[];
  query: string;
};

export const ProjectTable = ({ listLocation, onAction, projects, query }: ProjectTableProps) => (
  <div className="overflow-hidden border bg-card">
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
          <th className="w-14 px-3 py-3" scope="col">
            <span className="sr-only">Ações</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {projects.map((project) => (
          <tr className="group hover:bg-muted/25" key={project.id}>
            <td className="px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <ProjectCover
                  className="hidden h-10 w-[4.5rem] shrink-0 sm:grid"
                  compact
                  coverKey={project.coverKey}
                />
                <div className="min-w-0">
                  <Link
                    className="block truncate font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
                    state={{ projectListLocation: listLocation }}
                    to={`/documents/${project.id}`}
                  >
                    <HighlightText query={query} text={project.title} />
                  </Link>
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
              <ProjectActionsMenu
                className="border-transparent bg-transparent shadow-none group-hover:border-border group-hover:bg-background group-hover:shadow-sm"
                onChangeCover={() => onAction("cover", project)}
                onDelete={() => onAction("delete", project)}
                onRename={() => onAction("rename", project)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
