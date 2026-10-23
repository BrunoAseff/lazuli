import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { recentProjectsResponseSchema } from "@lazuli/shared";
import { apiRequest } from "@/lib/api-client.ts";

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
  const ids = projects.map(({ id }) => id).sort();
  const visible = useQuery({
    queryKey: ["projects", "recent", userId, ids],
    enabled: Boolean(userId) && ids.length > 0,
    queryFn: ({ signal }) =>
      apiRequest("/api/projects/recent", recentProjectsResponseSchema, {
        method: "POST",
        signal,
        body: JSON.stringify({ ids }),
      }),
  });

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

  useEffect(() => {
    if (!visible.data) return;
    setProjects((current) => {
      const next = current.flatMap((item) => {
        const valid = visible.data.items.find(({ id }) => id === item.id);
        return valid ? [{ ...item, title: valid.title }] : [];
      });
      if (JSON.stringify(current) === JSON.stringify(next)) return current;
      writeRecentProjects(localStorage, userId, next);
      return next;
    });
  }, [visible.data, userId]);
  return projects.filter((item) => visible.data?.items.some(({ id }) => id === item.id));
};
