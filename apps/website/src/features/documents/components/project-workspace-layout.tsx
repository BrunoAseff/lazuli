import { Outlet, useParams } from "react-router";

import { useProjectTree } from "../api/document-queries.ts";
import { useProject } from "@/features/projects/api/project-queries.ts";
import { ProjectWorkspace } from "./project-workspace.tsx";

export const ProjectWorkspaceLayout = () => {
  const { projectId = "", documentId } = useParams();
  const tree = useProjectTree(projectId);
  const project = useProject(projectId);

  return (
    <ProjectWorkspace
      activeDocumentId={documentId}
      items={tree.data?.items ?? []}
      projectId={projectId}
      projectTitle={project.data?.title}
    >
      <Outlet />
    </ProjectWorkspace>
  );
};

export default ProjectWorkspaceLayout;
