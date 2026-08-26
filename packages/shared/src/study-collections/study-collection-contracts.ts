import { z } from "zod";

import { projectIdSchema } from "../projects/project-contracts.ts";

export const STUDY_COLLECTION_PAGE_SIZE = 12;
export const STUDY_COLLECTION_MAX_PAGE_SIZE = 24;

export const studyCollectionIdSchema = z.uuid();
export const studyCollectionTitleSchema = z
  .string()
  .trim()
  .min(1, "Informe o título da coleção.")
  .max(100, "O título deve ter no máximo 100 caracteres.")
  .transform((title) => title.replace(/\s+/g, " "));
export const studyCollectionStatusSchema = z.enum(["active", "archived"]);
export const studyCollectionProjectFilterSchema = z.union([projectIdSchema, z.literal("none")]);

export const studyCollectionListQueryShape = {
  query: z.string().trim().max(100).default(""),
  project: studyCollectionProjectFilterSchema.optional(),
  status: studyCollectionStatusSchema.default("active"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(STUDY_COLLECTION_MAX_PAGE_SIZE)
    .default(STUDY_COLLECTION_PAGE_SIZE),
};

export const createStudyCollectionShape = {
  id: studyCollectionIdSchema,
  title: studyCollectionTitleSchema,
  projectId: projectIdSchema.nullable().default(null),
};
export const createStudyCollectionSchema = z.object(createStudyCollectionShape).strict();

export const updateStudyCollectionSchema = z
  .object({
    title: studyCollectionTitleSchema.optional(),
    projectId: projectIdSchema.nullable().optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine(
    ({ archived, projectId, title }) =>
      archived !== undefined || projectId !== undefined || title !== undefined,
    { message: "Informe ao menos uma alteração." },
  );

export type StudyCollectionStatus = z.infer<typeof studyCollectionStatusSchema>;
export type CreateStudyCollectionInput = z.infer<typeof createStudyCollectionSchema>;
export type UpdateStudyCollectionInput = z.infer<typeof updateStudyCollectionSchema>;
