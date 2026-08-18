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
import type { z } from "zod";

const API_URL = import.meta.env.VITE_API_URL;

export class ProjectApiError extends Error {
  code?: string;
  status: number;

  constructor(status: number, code?: string) {
    super(`Project request failed with status ${status}`);
    this.name = "ProjectApiError";
    this.status = status;
    this.code = code;
  }
}

const request = async <T>(
  path: string,
  schema: z.ZodType<T> | null,
  init: RequestInit = {},
): Promise<T> => {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { code?: string } | null;
    throw new ProjectApiError(response.status, body?.code);
  }

  if (!schema) {
    return undefined as T;
  }

  return schema.parse(await response.json());
};

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
