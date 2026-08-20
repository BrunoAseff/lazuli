import {
  documentListResponseSchema,
  type CreateProjectInput,
  type DocumentListResponse,
  type ProjectListQuery,
  projectListResponseSchema,
  type ProjectListResponse,
  type ProjectSummary,
  projectSummarySchema,
  type UpdateProjectInput,
} from "@lazuli/shared";
import { ApiError, apiRequest as request } from "@/lib/api-client.ts";

export { ApiError as ProjectApiError };

const toSearchParams = ({ page, pageSize, query }: ProjectListQuery) => {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (query) params.set("query", query);
  return params;
};

export const fetchProjects = (
  input: ProjectListQuery,
  signal?: AbortSignal,
): Promise<ProjectListResponse> =>
  request(`/api/projects?${toSearchParams(input)}`, projectListResponseSchema, { signal });

export const fetchProject = (projectId: string, signal?: AbortSignal): Promise<ProjectSummary> =>
  request(`/api/projects/${encodeURIComponent(projectId)}`, projectSummarySchema, { signal });

export const postProject = (input: CreateProjectInput): Promise<ProjectSummary> =>
  request("/api/projects", projectSummarySchema, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const patchProject = (
  projectId: string,
  input: UpdateProjectInput,
): Promise<ProjectSummary> =>
  request(`/api/projects/${encodeURIComponent(projectId)}`, projectSummarySchema, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const removeProject = (projectId: string): Promise<void> =>
  request(`/api/projects/${encodeURIComponent(projectId)}`, null, { method: "DELETE" });

export const fetchProjectDocuments = (
  projectId: string,
  input: ProjectListQuery,
  signal?: AbortSignal,
): Promise<DocumentListResponse> =>
  request(
    `/api/projects/${encodeURIComponent(projectId)}/documents?${toSearchParams(input)}`,
    documentListResponseSchema,
    { signal },
  );
