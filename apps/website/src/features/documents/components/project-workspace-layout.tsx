import { Outlet, useParams } from "react-router";

import { useProjectTree } from "../api/document-queries.ts";
import { ProjectWorkspace } from "./project-workspace.tsx";

export const ProjectWorkspaceLayout = () => {
  const { projectId = "", documentId } = useParams();
  const tree = useProjectTree(projectId);

  return (
    <ProjectWorkspace
      activeDocumentId={documentId}
      items={tree.data?.items ?? []}
      projectId={projectId}
    >
      <Outlet />
    </ProjectWorkspace>
  );
};

export default ProjectWorkspaceLayout;
