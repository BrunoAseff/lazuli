import { z } from "zod";

export const PROJECT_PAGE_SIZE = 12;
export const PROJECT_MAX_PAGE_SIZE = 24;

export const PROJECT_COVER_KEYS = [
  "library",
  "letters",
  "geometry",
  "orbit",
  "circuits",
  "laboratory",
  "botany",
  "atlas",
  "studio",
  "rhythm",
] as const;

export const projectCoverKeySchema = z.enum(PROJECT_COVER_KEYS);

export const projectTitleSchema = z
  .string()
  .trim()
  .min(1, "Informe o título do projeto.")
  .max(100, "O título deve ter no máximo 100 caracteres.")
  .transform((title) => title.replace(/\s+/g, " "));

export const projectIdSchema = z.uuid();

export const projectListQuerySchema = z.object({
  query: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(PROJECT_MAX_PAGE_SIZE)
    .default(PROJECT_PAGE_SIZE),
});

export const createProjectSchema = z.object({
  id: projectIdSchema,
  title: projectTitleSchema,
  coverKey: projectCoverKeySchema.nullable().default(null),
});

export const updateProjectSchema = z
  .object({
    title: projectTitleSchema.optional(),
    coverKey: projectCoverKeySchema.nullable().optional(),
  })
  .refine(({ coverKey, title }) => coverKey !== undefined || title !== undefined, {
    message: "Informe ao menos uma alteração.",
  });

export const paginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const projectSummarySchema = z.object({
  id: projectIdSchema,
  title: z.string(),
  coverKey: projectCoverKeySchema.nullable(),
  documentCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const projectListResponseSchema = z.object({
  items: z.array(projectSummarySchema),
  pagination: paginationSchema,
});

export const documentSummarySchema = z.object({
  id: projectIdSchema,
  title: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const documentListResponseSchema = z.object({
  items: z.array(documentSummarySchema),
  pagination: paginationSchema,
});

export type ProjectCoverKey = z.infer<typeof projectCoverKeySchema>;
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;
export type DocumentSummary = z.infer<typeof documentSummarySchema>;
export type DocumentListResponse = z.infer<typeof documentListResponseSchema>;
