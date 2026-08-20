import type { z } from "zod";

export const API_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  status: number;
  code?: string;
  payload?: unknown;

  constructor(status: number, code?: string, payload?: unknown) {
    super(`API request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export const apiRequest = async <T>(
  path: string,
  schema: z.ZodType<T> | null,
  init: RequestInit = {},
): Promise<T> => {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type"))
    headers.set("content-type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, credentials: "include", headers });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { code?: string } | null;
    throw new ApiError(response.status, payload?.code, payload);
  }
  if (!schema) return undefined as T;
  return schema.parse(await response.json());
};
