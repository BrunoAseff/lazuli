import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";

import { useProject } from "@/features/projects/api/project-queries.ts";
import {
  readRecentProjects,
  rememberRecentProject,
  type RecentProject,
  writeRecentProjects,
} from "@/features/projects/recent-projects.ts";

const projectIdFromPathname = (pathname: string) =>
  pathname.match(/^\/documents\/([^/]+)/)?.[1] ?? "";

export const useRecentProjects = (userId: string) => {
  const { pathname } = useLocation();
  const projectId = useMemo(() => projectIdFromPathname(pathname), [pathname]);
  const projectQuery = useProject(projectId, Boolean(projectId));
  const [projects, setProjects] = useState<RecentProject[]>([]);

  useEffect(() => {
    setProjects(readRecentProjects(localStorage, userId));
  }, [userId]);

  useEffect(() => {
    const project = projectQuery.data;
    if (!project) return;
    setProjects((current) => {
      const next = rememberRecentProject(current, project);
      writeRecentProjects(localStorage, userId, next);
      return next;
    });
  }, [projectQuery.data, userId]);

  return projects;
};
