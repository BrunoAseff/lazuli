import type {
  CreateProjectItemInput,
  DocumentResponse,
  ProjectTreeResponse,
  SaveDocumentContentInput,
  UpdateProjectItemInput,
} from "@lazuli/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { projectKeys } from "@/features/projects/api/project-queries.ts";
import {
  fetchDocument,
  fetchProjectTree,
  patchProjectItem,
  postProjectItem,
  putDocumentContent,
  removeProjectItem,
} from "./document-api.ts";
import { collectProjectDescendantIds } from "../project-tree.ts";

export const documentKeys = {
  all: ["documents"] as const,
  tree: (projectId: string) => [...documentKeys.all, "tree", projectId] as const,
  detail: (projectId: string, documentId: string) =>
    [...documentKeys.all, "detail", projectId, documentId] as const,
};
const setTreeItem = (
  client: ReturnType<typeof useQueryClient>,
  projectId: string,
  item: ProjectTreeResponse["items"][number],
) =>
  client.setQueryData<ProjectTreeResponse>(documentKeys.tree(projectId), (current) =>
    current
      ? {
          items: current.items.some((value) => value.id === item.id)
            ? current.items.map((value) => (value.id === item.id ? item : value))
            : [...current.items, item],
        }
      : current,
  );
export const useProjectTree = (projectId: string, enabled = true) =>
  useQuery({
    enabled,
    queryKey: documentKeys.tree(projectId),
    queryFn: ({ signal }) => fetchProjectTree(projectId, signal),
  });
export const useDocument = (projectId: string, documentId: string) =>
  useQuery({
    queryKey: documentKeys.detail(projectId, documentId),
    queryFn: ({ signal }) => fetchDocument(projectId, documentId, signal),
  });
export const useCreateProjectItem = (projectId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectItemInput) => postProjectItem(projectId, input),
    onSuccess: (item) => {
      setTreeItem(client, projectId, item);
      void Promise.all([
        client.invalidateQueries({ exact: true, queryKey: projectKeys.detail(projectId) }),
        client.invalidateQueries({ queryKey: projectKeys.projectDocuments(projectId) }),
        client.invalidateQueries({ queryKey: projectKeys.lists() }),
      ]);
    },
  });
};
export const useRenameProjectItem = (projectId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: UpdateProjectItemInput }) =>
      patchProjectItem(projectId, itemId, input),
    onSuccess: (item) => {
      setTreeItem(client, projectId, item);
      if (item.type === "document") {
        const documentItem: DocumentResponse["item"] = { ...item, type: "document" };
        client.setQueryData<DocumentResponse>(documentKeys.detail(projectId, item.id), (current) =>
          current ? { ...current, item: documentItem } : current,
        );
      }
      void client.invalidateQueries({ queryKey: projectKeys.projectDocuments(projectId) });
    },
  });
};
export const useMoveProjectItem = (projectId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: UpdateProjectItemInput }) =>
      patchProjectItem(projectId, itemId, input),
    onSuccess: (item) => setTreeItem(client, projectId, item),
  });
};
export const useDeleteProjectItem = (projectId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => removeProjectItem(projectId, itemId),
    onSuccess: (_, itemId) => {
      client.setQueryData<ProjectTreeResponse>(documentKeys.tree(projectId), (current) => {
        if (!current) return current;
        const removed = collectProjectDescendantIds(current.items, itemId);
        for (const removedId of removed)
          client.removeQueries({ queryKey: documentKeys.detail(projectId, removedId) });
        return { items: current.items.filter((item) => !removed.has(item.id)) };
      });
      void Promise.all([
        client.invalidateQueries({ exact: true, queryKey: projectKeys.detail(projectId) }),
        client.invalidateQueries({ queryKey: projectKeys.projectDocuments(projectId) }),
        client.invalidateQueries({ queryKey: projectKeys.lists() }),
      ]);
    },
  });
};
export const useSaveDocument = (projectId: string, documentId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveDocumentContentInput) =>
      putDocumentContent(projectId, documentId, input),
    onSuccess: (result, input) => {
      client.setQueryData<DocumentResponse>(documentKeys.detail(projectId, documentId), (current) =>
        current
          ? {
              ...current,
              content: input.content,
              revision: result.revision,
              item: { ...current.item, updatedAt: result.updatedAt },
            }
          : current,
      );
      client.setQueryData<ProjectTreeResponse>(documentKeys.tree(projectId), (current) =>
        current
          ? {
              items: current.items.map((item) =>
                item.id === documentId ? { ...item, updatedAt: result.updatedAt } : item,
              ),
            }
          : current,
      );
      void client.invalidateQueries({ queryKey: projectKeys.projectDocuments(projectId) });
    },
  });
};
