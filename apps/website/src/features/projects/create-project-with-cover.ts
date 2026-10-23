import {
  createProjectSchema,
  type CreateProjectInput,
  type ProjectSummary,
  type UpdateProjectInput,
} from "@lazuli/shared";
import type { CoverSelection } from "./components/project-cover-editor.tsx";

export const createProjectWithCover = async ({
  input,
  selection,
  existing,
  onCreated,
  operations,
}: {
  input: CreateProjectInput;
  selection: CoverSelection;
  existing: ProjectSummary | null;
  onCreated: (project: ProjectSummary) => void;
  operations: {
    create: (input: CreateProjectInput) => Promise<ProjectSummary>;
    upload: (project: ProjectSummary, selection: CoverSelection) => Promise<ProjectSummary>;
    update: (id: string, input: UpdateProjectInput) => Promise<ProjectSummary>;
  };
}) => {
  const project =
    existing ??
    (await operations.create(
      createProjectSchema.parse({
        ...input,
        coverKey: selection.mode === "gallery" ? selection.preset : null,
      }),
    ));
  if (!existing) onCreated(project);
  if (selection.mode === "upload") return operations.upload(project, selection);
  return project.coverKey !== selection.preset
    ? operations.update(project.id, { coverKey: selection.preset })
    : project;
};
