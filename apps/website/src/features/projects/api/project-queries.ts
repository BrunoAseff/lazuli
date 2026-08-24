import { PROJECT_PAGE_SIZE, type ProjectListQuery, type UpdateProjectInput } from "@lazuli/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEY_ROOTS } from "@/lib/query-key-roots.ts";
import {
  fetchProject,
  fetchProjectDocuments,
  fetchProjects,
  patchProject,
  postProject,
  removeProject,
} from "./project-api.ts";

export const projectKeys = {
  all: QUERY_KEY_ROOTS.projects,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (input: ProjectListQuery) => [...projectKeys.lists(), input] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (projectId: string) => [...projectKeys.details(), projectId] as const,
  projectDocuments: (projectId: string) => [...projectKeys.all, "documents", projectId] as const,
  documents: (projectId: string, input: ProjectListQuery) =>
    [...projectKeys.projectDocuments(projectId), input] as const,
};

export const useProjects = (input: ProjectListQuery, enabled = true) =>
  useQuery({
    queryKey: projectKeys.list(input),
    queryFn: ({ signal }) => fetchProjects(input, signal),
    enabled,
  });

export const useProject = (projectId: string, enabled = true) =>
  useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: ({ signal }) => fetchProject(projectId, signal),
    enabled,
  });

export const useProjectDocuments = (
  projectId: string,
  page: number,
  pageSize = PROJECT_PAGE_SIZE,
) => {
  const input = { page, pageSize, query: "" };
  return useQuery({
    queryKey: projectKeys.documents(projectId, input),
    queryFn: ({ signal }) => fetchProjectDocuments(projectId, input, signal),
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postProject,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: projectKeys.lists() }),
  });
};

export const useUpdateProject = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => patchProject(projectId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROOTS.flashcardCollections }),
      ]);
    },
  });
};

export const useDeleteProject = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => removeProject(projectId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: projectKeys.detail(projectId) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROOTS.flashcardCollections }),
      ]);
    },
  });
};
